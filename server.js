
const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();
const session = require("express-session");
const bcrypt = require("bcryptjs");
const MySQLStore = require("express-mysql-session")(session);
const { rateLimit } = require("express-rate-limit");
const fs = require("fs");
const path = require("path");


const app = express();
const PORT = process.env.PORT || 3000;

// CONEXIÓN CON MYSQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 4000),

    waitForConnections: true,
    connectionLimit: 10,

    ssl: {
        ca: fs.readFileSync(
            path.join(__dirname, "tidb-ca.pem")
        ),
        minVersion: "TLSv1.2"
    }
});

// ALMACENAMIENTO DE SESIONES
const sessionStore = new MySQLStore({
    expiration: 1000 * 60 * 60 * 2,
    createDatabaseTable: true
}, pool);

app.use(express.json());

app.use(session({
    name: "biblioteca.sid",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 2
    }
}));

app.use(express.static(__dirname));
// PROTECCIÓN CONTRA SOLICITUDES DE OTROS SITIOS
function verificarOrigen(req, res, next) {
    const origen = req.get("origin");

    if (!origen) {
        return res.status(403).json({
            error: "Solicitud sin origen válido."
        });
    }

    try {
        const urlOrigen = new URL(origen);

        if (urlOrigen.host !== req.get("host")) {
            return res.status(403).json({
                error: "Solicitud bloqueada por seguridad."
            });
        }

        next();

    } catch (error) {
        return res.status(403).json({
            error: "Origen no válido."
        });
    }
}

// ====================================
// AUTENTICACIÓN DE ADMINISTRADORES
// ====================================

const administradores = [
    {
        usuario: process.env.ADMIN1_USER,
        hash: process.env.ADMIN1_HASH
    },
    {
        usuario: process.env.ADMIN2_USER,
        hash: process.env.ADMIN2_HASH
    }
];

// Verificar si hay una sesión administrativa
function requiereAdmin(req, res, next) {
    if (!req.session.admin) {
        return res.status(401).json({
            error: "Debes iniciar sesión como administrador."
        });
    }

    next();
}
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Demasiados intentos. Intenta nuevamente después de 15 minutos."
    }
});

// INICIAR SESIÓN
app.post("/api/login", loginLimiter, async (req, res) => {
    try {
        const { usuario, contrasena } = req.body;

        if (!usuario || !contrasena) {
            return res.status(400).json({
                error: "Completa el usuario y la contraseña."
            });
        }

        const administrador = administradores.find(
            admin => admin.usuario === usuario
        );

        if (
            !administrador ||
            !administrador.hash ||
            !(await bcrypt.compare(contrasena, administrador.hash))
        ) {
            return res.status(401).json({
                error: "Usuario o contraseña incorrectos."
            });
        }

        await new Promise((resolve, reject) => {
            req.session.regenerate(error => {
                if (error) reject(error);
                else resolve();
            });
        });

        req.session.admin = {
            usuario: administrador.usuario
        };

        await new Promise((resolve, reject) => {
            req.session.save(error => {
                if (error) reject(error);
                else resolve();
            });
        });

        res.json({
            mensaje: "Inicio de sesión correcto.",
            usuario: administrador.usuario
        });

    } catch (error) {
        console.error("Error al iniciar sesión:", error);

        res.status(500).json({
            error: "No se pudo iniciar sesión."
        });
    }
});

// COMPROBAR SESIÓN
app.get("/api/sesion", (req, res) => {
    res.json({
        autenticado: Boolean(req.session.admin),
        usuario: req.session.admin?.usuario || null
    });
});

// CERRAR SESIÓN
app.post("/api/logout", verificarOrigen, (req, res) => {
    req.session.destroy(error => {

        if (error) {
            return res.status(500).json({
                error: "No se pudo cerrar la sesión."
            });
        }

        // Eliminar las cookies anteriores y actuales
        res.clearCookie("connect.sid");

        res.clearCookie("biblioteca.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/"
        });

        res.json({
            mensaje: "Sesión cerrada correctamente."
        });
    });
});

// PROBAR CONEXIÓN
app.get("/api/estado", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS conectado");

        res.json({
            mensaje: "Conexión con MySQL correcta",
            conectado: rows[0].conectado === 1
        });

    } catch (error) {
        console.error("Error de conexión:", error.message);

        res.status(500).json({
            mensaje: "No se pudo conectar con MySQL"
        });
    }
});

// OBTENER LIBROS
app.get("/api/libros", async (req, res) => {
    try {
        const [libros] = await pool.query(`
    SELECT
        ID,
        Clasificacion,
        Materias,
        Titulo,
        Autores,
        OtrosResponsables,
        Anio,
        Ejemplares,
        Descripcion,
        ImagenPortada
    FROM libros
    ORDER BY ID ASC
`);

        res.json(libros);

    } catch (error) {
        console.error("Error al consultar libros:", error.message);

        res.status(500).json({
            mensaje: "No se pudieron consultar los libros"
        });
    }
});

// AGREGAR LIBRO

app.post("/api/libros", verificarOrigen, requiereAdmin, async (req, res) => {
    try {
       const {
    serie,
    titulo,
    autor,
    anio,
    materia,
    otrosResponsables,
    ejemplares,
    descripcion,
    imagenPortada
} = req.body;

// Verificar que los datos sean texto
const campos = {
    serie,
    titulo,
    autor,
    anio,
    materia,
    otrosResponsables,
    ejemplares,
    descripcion,
    imagenPortada
};

for (const [nombre, valor] of Object.entries(campos)) {
    if (valor !== undefined && valor !== null &&
        typeof valor !== "string") {
        return res.status(400).json({
            error: `El campo ${nombre} debe contener texto.`
        });
    }
}

// Limpiar espacios al inicio y al final
const datos = Object.fromEntries(
    Object.entries(campos).map(([nombre, valor]) => [
        nombre,
        typeof valor === "string" ? valor.trim() : ""
    ])
);

// Verificar campos obligatorios
if (!datos.titulo || !datos.autor || !datos.serie) {
    return res.status(400).json({
        error: "El título, autor y número de serie son obligatorios."
    });
}

// Verificar longitud de los campos
const limites = {
    serie: 100,
    titulo: 500,
    autor: 500,
    anio: 20,
    materia: 500,
    otrosResponsables: 500,
    ejemplares: 100,
    descripcion: 5000,
    imagenPortada: 2000
};

for (const [nombre, limite] of Object.entries(limites)) {
    if (datos[nombre].length > limite) {
        return res.status(400).json({
            error: `El campo ${nombre} supera el máximo de ${limite} caracteres.`
        });
    }
}

        const conexion = await pool.getConnection();

        try {
            await conexion.beginTransaction();

            const [ultimo] = await conexion.query(
                "SELECT MAX(ID) AS ultimo_id FROM libros FOR UPDATE"
            );

            const nuevoID = Number(ultimo[0].ultimo_id || 0) + 1;

           await conexion.query(
    `INSERT INTO libros
    (ID, Clasificacion, Titulo, Autores, Anio,
     Materias, OtrosResponsables, Ejemplares, Descripcion,
     ImagenPortada)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        nuevoID,
        datos.serie,
        datos.titulo,
        datos.autor,
        datos.anio || null,
        datos.materia || null,
        datos.otrosResponsables || null,
        datos.ejemplares || null,
        datos.descripcion || null,
        datos.imagenPortada || null
    ]
);
             

            await conexion.commit();

            res.status(201).json({
                mensaje: "Libro agregado correctamente.",
                id: nuevoID
            });

        } catch (error) {
            await conexion.rollback();
            throw error;
        } finally {
            conexion.release();
        }

    } catch (error) {
        console.error("Error al agregar libro:", error);

        res.status(500).json({
            error: "No se pudo agregar el libro."
        });
    }
});

// EDITAR LIBRO
app.put("/api/libros/:id", verificarOrigen, requiereAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                error: "ID de libro inválido."
            });
        }

        const campos = {
            serie: req.body.serie,
            titulo: req.body.titulo,
            autor: req.body.autor,
            materia: req.body.materia,
            descripcion: req.body.descripcion,
            imagenPortada: req.body.imagenPortada
        };

        // Validar que los campos sean texto
        for (const [nombre, valor] of Object.entries(campos)) {
            if (valor !== undefined && valor !== null &&
                typeof valor !== "string") {
                return res.status(400).json({
                    error: `El campo ${nombre} debe contener texto.`
                });
            }
        }

        // Limpiar espacios
        const datos = Object.fromEntries(
            Object.entries(campos).map(([nombre, valor]) => [
                nombre,
                typeof valor === "string" ? valor.trim() : ""
            ])
        );

        // Validar campos obligatorios
        if (!datos.titulo || !datos.autor || !datos.serie) {
            return res.status(400).json({
                error: "El título, autor y número de serie son obligatorios."
            });
        }

        // Limitar longitud de los campos
        const limites = {
            serie: 100,
            titulo: 500,
            autor: 500,
            materia: 500,
            descripcion: 5000,
         imagenPortada: 2000
        };

        for (const [nombre, limite] of Object.entries(limites)) {
            if (datos[nombre].length > limite) {
                return res.status(400).json({
                    error: `El campo ${nombre} supera el máximo de ${limite} caracteres.`
                });
            }
        }

      const [resultado] = await pool.query(
    `UPDATE libros
     SET Clasificacion = ?,
         Titulo = ?,
         Autores = ?,
         Materias = ?,
         Descripcion = ?,
         ImagenPortada = ?
     WHERE ID = ?`,
    [
        datos.serie,
        datos.titulo,
        datos.autor,
        datos.materia || null,
        datos.descripcion || null,
        datos.imagenPortada || null,
        id
    ]
);

        if (resultado.affectedRows === 0) {
            const [existe] = await pool.query(
                "SELECT ID FROM libros WHERE ID = ?",
                [id]
            );

            if (existe.length === 0) {
                return res.status(404).json({
                    error: "No se encontró el libro."
                });
            }
        }

        res.json({
            mensaje: "Libro actualizado correctamente."
        });

    } catch (error) {
        console.error("Error al actualizar libro:", error);

        res.status(500).json({
            error: "No se pudo actualizar el libro."
        });
    }
});

/* REGISTRAR CLIC EN UN LIBRO */
app.post("/api/libros/:id/busqueda", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                error: "ID de libro inválido."
            });
        }

        await pool.query(
            `INSERT INTO busquedas_libros (libro_id, cantidad)
             VALUES (?, 1)
             ON DUPLICATE KEY UPDATE cantidad = cantidad + 1`,
            [id]
        );

        res.json({
            mensaje: "Búsqueda registrada."
        });

    } catch (error) {
        console.error("Error al registrar búsqueda:", error.message);

        res.status(500).json({
            error: "No se pudo registrar la búsqueda."
        });
    }
});

// GUARDAR SOLICITUDES
app.post("/api/solicitudes", async (req, res) => {
    try {
        const { titulo, autor, editorial, comentarios } = req.body;

const campos = { titulo, autor, editorial, comentarios };

// Comprobar que todos los datos sean texto
for (const [nombre, valor] of Object.entries(campos)) {
    if (valor !== undefined && valor !== null &&
        typeof valor !== "string") {
        return res.status(400).json({
            error: `El campo ${nombre} debe contener texto.`
        });
    }
}

// Limpiar espacios
const datos = Object.fromEntries(
    Object.entries(campos).map(([nombre, valor]) => [
        nombre,
        typeof valor === "string" ? valor.trim() : ""
    ])
);

// Validar campos obligatorios
if (!datos.titulo || !datos.autor) {
    return res.status(400).json({
        error: "El título y el autor son obligatorios."
    });
}

// Limitar longitud de los datos
const limites = {
    titulo: 500,
    autor: 500,
    editorial: 300,
    comentarios: 1000
};

for (const [nombre, limite] of Object.entries(limites)) {
    if (datos[nombre].length > limite) {
        return res.status(400).json({
            error: `El campo ${nombre} supera el máximo de ${limite} caracteres.`
        });
    }
}

                await pool.query(
            `INSERT INTO solicitudes_libros
            (titulo, autor, editorial, comentarios)
            VALUES (?, ?, ?, ?)`,
            [
                datos.titulo,
                datos.autor,
                datos.editorial || null,
                datos.comentarios || null
            ]
        );

        res.status(201).json({
            mensaje: "Solicitud guardada correctamente."
        });

    } catch (error) {
        console.error("Error al guardar solicitud:", error.message);

        res.status(500).json({
            error: "No se pudo guardar la solicitud."
        });
    }
});

// CONSULTAR SOLICITUDES
app.get("/api/solicitudes", requiereAdmin, async (req, res) => {
    try {
        const [solicitudes] = await pool.query(
            `SELECT * FROM solicitudes_libros
             ORDER BY fecha_solicitud DESC`
        );

        res.json(solicitudes);

    } catch (error) {
        console.error("Error al consultar solicitudes:", error.message);

        res.status(500).json({
            error: "No se pudieron consultar las solicitudes."
        });
    }
});

// ACTUALIZAR ESTADO DE SOLICITUD


app.put("/api/solicitudes/:id/estado", verificarOrigen, requiereAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { estado } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                error: "ID de solicitud inválido."
            });
        }

        if (!["Confirmada", "Rechazada"].includes(estado)) {
            return res.status(400).json({
                error: "Estado no válido."
            });
        }

        const [resultado] = await pool.query(
            `UPDATE solicitudes_libros
             SET estado = ?, fecha_resolucion = NOW()
             WHERE id = ? AND estado = 'Pendiente'`,
            [estado, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                error: "No se encontró la solicitud pendiente."
            });
        }

        res.json({
            mensaje: `Solicitud ${estado.toLowerCase()} correctamente. Se eliminará después de 7 días.`
        });

    } catch (error) {
        console.error("Error al actualizar solicitud:", error);

        res.status(500).json({
            error: "No se pudo actualizar la solicitud."
        });
    }
});

// ELIMINAR SOLICITUDES DESPUÉS DE 7 DÍAS


async function eliminarSolicitudesAntiguas() {
    try {
        const [resultado] = await pool.query(`
            DELETE FROM solicitudes_libros
            WHERE estado IN ('Confirmada', 'Rechazada')
            AND fecha_resolucion IS NOT NULL
            AND fecha_resolucion <= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);

        if (resultado.affectedRows > 0) {
            console.log(
                `Se eliminaron ${resultado.affectedRows} solicitudes antiguas.`
            );
        }

    } catch (error) {
        console.error(
            "Error al eliminar solicitudes antiguas:",
            error
        );
    }
}

// Revisar al iniciar el servidor
eliminarSolicitudesAntiguas();

// Revisar automáticamente cada hora
setInterval(eliminarSolicitudesAntiguas, 60 * 60 * 1000);

// LIBROS MÁS BUSCADOS

app.get("/api/libros-mas-buscados", async (req, res) => {
    try {
        const [resultados] = await pool.query(`
            SELECT 
                l.ID,
                l.Clasificacion,
                l.Titulo,
                l.Autores,
                l.Anio,
                b.cantidad
            FROM busquedas_libros b
            JOIN libros l ON l.ID = b.libro_id
            ORDER BY b.cantidad DESC
            LIMIT 10
        `);

        res.json(resultados);

    } catch (error) {
        console.error("Error al obtener libros más buscados:", error);
        res.status(500).json({
            error: "No se pudieron obtener los libros más buscados."
        });
    }
});

// ESTADÍSTICAS DE LIBROS

app.get("/api/estadisticas-libros", requiereAdmin, async (req, res) => {
    try {
        const [resultados] = await pool.query(`
            SELECT 
                l.Titulo,
                b.cantidad
            FROM busquedas_libros b
            JOIN libros l ON l.ID = b.libro_id
            ORDER BY b.cantidad DESC
            LIMIT 10
        `);

        const [total] = await pool.query(`
            SELECT SUM(cantidad) AS total
            FROM busquedas_libros
        `);


        const [materias] = await pool.query(`
            SELECT
                l.Materias,
                SUM(b.cantidad) AS cantidad
            FROM busquedas_libros b
            JOIN libros l ON l.ID = b.libro_id
            GROUP BY l.Materias
            ORDER BY cantidad DESC
            LIMIT 10
        `);


       res.json({
    libros: resultados,
    total: total[0].total || 0,
    materias: materias

        });

    } catch (error) {
        console.error("Error al obtener estadísticas:", error);
        res.status(500).json({
            error: "No se pudieron obtener las estadísticas."
        });
    }
});


// ELIMINAR LIBRO

app.delete("/api/libros/:id", requiereAdmin, async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "ID de libro inválido."
        });
    }

    let conexion;
    let transaccionIniciada = false;

    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();
        transaccionIniciada = true;     

        const [librosEncontrados] = await conexion.query(
            "SELECT ID FROM libros WHERE ID = ? FOR UPDATE",
            [id]
        );

        if (librosEncontrados.length === 0) {
            await conexion.rollback();
            transaccionIniciada = false;

            return res.status(404).json({
                error: "No se encontró el libro."
            });
        }

        // Eliminar primero sus registros de búsquedas
        await conexion.query(
            "DELETE FROM busquedas_libros WHERE libro_id = ?",
            [id]
        );

        // Eliminar el libro
        await conexion.query(
            "DELETE FROM libros WHERE ID = ?",
            [id]
        );

        await conexion.commit();
        transaccionIniciada = false;

        res.json({
            mensaje: "Libro eliminado correctamente."
        });

    } catch (error) {
        if (conexion && transaccionIniciada) {
    await conexion.rollback();
    transaccionIniciada = false;
        }

        console.error("Error al eliminar libro:", error);

        res.status(500).json({
            error: "No se pudo eliminar el libro."
        });

    } finally {
        if (conexion) conexion.release();
    }
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
