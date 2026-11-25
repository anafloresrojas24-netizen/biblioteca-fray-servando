
"use strict";


// CONFIGURACIÓN

const USUARIO_ADMIN = "admin";
const CONTRASENA_ADMIN = "1234";
const NUMERO_DISPONIBILIDAD = "81 2020 9237";

const LIMITE_LIBROS_PRINCIPAL = 100;
const LIMITE_RESULTADOS_ADMIN = 5;

const ventanaLibro = document.getElementById("ventana-libro");
const ventanaLogin = document.getElementById("ventana-login");
const ventanaAdmin = document.getElementById("ventana-admin");
const ventanaSolicitudes = document.getElementById("ventana-solicitudes");
const catalogo = document.getElementById("catalogo");
const sinResultados = document.getElementById("sin-resultados");

let libros = [];

// FUNCIONES AUXILIARES

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = String(texto ?? "");
    return div.innerHTML;
}

// Calcula el rango de clasificación usando el ID del libro.
function detectarTema(idLibro) {
    const id = Number(idLibro);

    if (!Number.isFinite(id)) return "";

    if (id >= 25 && id <= 2218) return "Obras generales";
    if (id >= 2219 && id <= 4482) return "Filosofía y psicología";
    if (id >= 4483 && id <= 5228) return "Religión";
    if (id >= 5229 && id <= 11696) return "Ciencias sociales";
    if (id >= 11697 && id <= 12064) return "Lenguas";
    if (id >= 12065 && id <= 14254) return "Ciencias naturales";
    if (id >= 14255 && id <= 18443) return "Tecnología";
    if (id >= 18444 && id <= 20020) return "Artes";
    if (id >= 20021 && id <= 24274) return "Literatura";
    if (id >= 24275 && id <= 27434) return "Historia / Geografía";

    return "";
}

function obtenerTema(libro) {
    return libro.clasificacion || "";
}


// OBTENER IMAGEN SEGÚN LA CLASIFICACIÓN
function obtenerImagenCategoria(idLibro) {
    const id = Number(idLibro);
    let imagen = "";

    if (id >= 25 && id <= 2218)
        imagen = "obras generales.png";

    else if (id >= 2219 && id <= 4482)
        imagen = "Filosofía y psicología clásica.png";

    else if (id >= 4483 && id <= 5228)
        imagen = "Religion.png";

    else if (id >= 5229 && id <= 11696)
        imagen = "Ciencias Sociales.png";

    else if (id >= 11697 && id <= 12064)
        imagen = "lenguas.png";

    else if (id >= 12065 && id <= 14254)
        imagen = "Ciencias Naturales.png";

    else if (id >= 14255 && id <= 18443)
        imagen = "Tecnología.png";

    else if (id >= 18444 && id <= 20020)
        imagen = "artes.png";

    else if (id >= 20021 && id <= 24274)
        imagen = "literatura.png";

    else if (id >= 24275 && id <= 27434)
        imagen = "Historia y Geografía.png";

    return imagen
        ? `imagenes de biblioteca/${imagen}`
        : "https://placehold.co/300x420?text=Libro";
}


// CARGAR LIBROS DESDE MYSQL

async function cargarLibrosDesdeBD() {
    try {
        const respuesta = await fetch("/api/libros");

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los libros desde MySQL.");
        }

        const registros = await respuesta.json();

       libros = registros.map(registro => {
   const numeroSerie = String(
    registro.Clasificacion ?? ""
).trim();

return {
    id: registro.ID,

    titulo: String(
        registro.Titulo ?? "Título no disponible"
    ),

    autor: String(
        registro.Autores ?? "Autor no disponible"
    ),

    // Materia obtenida directamente de MySQL
    materia: String(
        registro.Materias ?? ""
    ).trim(),

    otrosResponsables: String(
        registro.OtrosResponsables ?? ""
    ),

    anio: String(
        registro.Anio ?? ""
    ),

    ejemplares: String(
        registro.Ejemplares ?? ""
    ),

    // Número de serie original
    serie: numeroSerie,

    // Rango calculado a partir del número de serie
  clasificacion: detectarTema(registro.ID),

    // Por ahora, portada provisional
// URL de portada guardada en MySQL
imagenPortada: String(
    registro.ImagenPortada ?? ""
).trim(),

// Imagen de categoría que se usa como alternativa
imagen: registro.Materias && String(registro.Materias).trim() !== ""
    ? obtenerImagenCategoria(registro.ID)
    : "imagenes de biblioteca/sin categoria.jpeg",

    descripcion: String(
        registro.Descripcion ?? ""
    )
};
});

        mostrarLibros();

    } catch (error) {
        console.error("Error al cargar libros:", error);

        catalogo.innerHTML = "";
        sinResultados.style.display = "block";

        sinResultados.textContent =
            "No se pudieron cargar los libros. Verifica que MySQL y el servidor estén iniciados.";
    }
}


// MOSTRAR CATÁLOGO

function mostrarLibros(lista = libros) {
    catalogo.innerHTML = "";

    if (!lista.length) {
        sinResultados.style.display = "block";
        sinResultados.textContent = "No se encontraron libros.";
        return;
    }

    sinResultados.style.display = "none";

    lista.slice(0, LIMITE_LIBROS_PRINCIPAL).forEach(libro => {

        const indice = libros.indexOf(libro);
        const article = document.createElement("article");

        article.className = "libro";

        article.innerHTML = `
            <img
                src="${escaparHTML(libro.imagenPortada || libro.ImagenPortada || libro.imagen || '')}"
                alt="${escaparHTML(libro.titulo)}">

            <div class="datos-libro">

                <h3>${escaparHTML(libro.titulo)}</h3>

                <p class="numero-serie">
                    <strong>Número de serie:</strong>
                    ${escaparHTML(libro.serie)}
                </p>

                <p>
                    <strong>Autor:</strong>
                    ${escaparHTML(libro.autor)}
                </p>

                <p>
                    <strong>Materia:</strong>
                    ${escaparHTML(libro.materia || "No especificada")}
                </p>

                <p>
                    <strong>Clasificación:</strong>
                    ${escaparHTML(libro.clasificacion)}
                </p>

                <p class="contacto-disponibilidad">
                    Contacta al siguiente número para ver la disponibilidad:
                    <strong>${NUMERO_DISPONIBILIDAD}</strong>
                </p>

                <p class="descripcion">
                    ${escaparHTML(libro.descripcion)}
                </p>

            </div>
        `;

        const imagen = article.querySelector("img");

        imagen.onerror = () => {
            imagen.onerror = null;
            imagen.src = "https://placehold.co/300x420?text=Libro";
        };

        article.addEventListener("click", () => abrirLibro(indice));

        catalogo.appendChild(article);
    });
}

// FILTROS Y BUSCADOR

function filtrarTema(tema) {
    document.getElementById("buscador").value = "";

    const resultados = libros.filter(libro => {
        return detectarTema(libro.id) === tema;
    });

    console.log("Categoría seleccionada:", tema);
    console.log("Libros encontrados:", resultados.length);
    console.log("Primeros resultados:", resultados.slice(0, 5));

    mostrarLibros(resultados);
}

function mostrarTodos() {
    document.getElementById("buscador").value = "";
    mostrarLibros();
}

function buscarLibro() {
    const texto = document.getElementById("buscador")
        .value.toLowerCase().trim();

    if (!texto) {
        mostrarLibros();
        return;
    }

    const resultados = libros.filter(libro => {
        const datos = [
            libro.titulo,
            libro.autor,
            libro.materia,
            libro.serie,
            libro.clasificacion,
            libro.id
        ];

        return datos.some(valor =>
            String(valor ?? "").toLowerCase().includes(texto)
        );
    });

    mostrarLibros(resultados);
}

// DETALLES DEL LIBRO


function abrirLibro(indice) {
    const libro = libros[indice];

    if (!libro) return;

    // Registrar que el usuario abrió este libro
    fetch(`/api/libros/${libro.id}/busqueda`, {
        method: "POST"
    }).catch(error => {
        console.error("Error al registrar búsqueda:", error);
    });


    document.getElementById("titulo-modal").textContent =
        libro.titulo;

    // Número de serie: código original de MySQL.
    document.getElementById("numero-serie-modal").textContent =
        libro.serie;

    document.getElementById("autor-modal").textContent =
        libro.autor;


    // Clasificación: rango calculado con el ID.
    document.getElementById("tema-modal").textContent =
        libro.clasificacion;

            // Mostrar los datos del libro.
    document.getElementById("materia-modal").textContent =
        libro.materia || "No especificada";

    document.getElementById("responsables-modal").textContent =
        libro.otrosResponsables || "No especificados";

    document.getElementById("anio-modal").textContent =
        libro.anio || "No especificado";

    document.getElementById("ejemplares-modal").textContent =
        libro.ejemplares || "No especificado";

    // Cambiar la etiqueta de Tema a Clasificación.
    const etiqueta = document.getElementById("tema-modal")
        .previousElementSibling;

    if (etiqueta) {
        etiqueta.textContent = "Clasificación:";
    }

    document.getElementById("descripcion-modal").textContent =
        libro.descripcion;

    const imagen = document.getElementById("imagen-modal");

    imagen.src =
    libro.imagenPortada || libro.ImagenPortada || libro.imagen || "";

    imagen.alt = libro.titulo;

    imagen.onerror = () => {
        imagen.onerror = null;
        imagen.src = "https://placehold.co/300x420?text=Libro";
    };

    ventanaLibro.style.display = "flex";
}

function cerrarLibro() {
    ventanaLibro.style.display = "none";
}


// INICIO Y CIERRE DE SESIÓN

async function abrirLogin() {
    try {
        const respuesta = await fetch("/api/sesion");
        const resultado = await respuesta.json();

        if (resultado.autenticado) {
            abrirAdmin();
            return;
        }

    } catch (error) {
        console.error("Error al comprobar sesión:", error);
    }

    document.getElementById("usuario").value = "";
    document.getElementById("contrasena").value = "";
    document.getElementById("mensaje-login").textContent = "";

    ventanaLogin.style.display = "flex";

    document.getElementById("usuario").focus();
}


function cerrarLogin() {
    ventanaLogin.style.display = "none";
}

async function iniciarSesion(event) {
    event.preventDefault();

    const usuario = document.getElementById("usuario").value.trim();
    const contrasena = document.getElementById("contrasena").value;

    const mensaje = document.getElementById("mensaje-login");

    try {
        const respuesta = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                usuario,
                contrasena
            })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            mensaje.textContent =
                resultado.error || "Usuario o contraseña incorrectos.";
            return;
        }

        cerrarLogin();
        abrirAdmin();

    } catch (error) {
        console.error("Error al iniciar sesión:", error);

        mensaje.textContent =
            "No se pudo conectar con el servidor.";
    }
}



// ADMINISTRACIÓN
function abrirAdmin() {
    ventanaAdmin.style.display = "flex";

    document.getElementById("buscador-admin").value = "";
    document.getElementById("lista-libros-admin").innerHTML = "";

    cancelarEdicion();
}


async function cerrarAdmin() {
    try {
        const respuesta = await fetch("/api/logout", {
            method: "POST"
        });

        if (!respuesta.ok) {
            throw new Error("No se pudo cerrar la sesión.");
        }

        ventanaAdmin.style.display = "none";

        cancelarEdicion();
        mostrarLibros();

    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        alert(error.message);
    }
}

        function ocultarAdmin() {
            ventanaAdmin.style.display = "none";

            cancelarEdicion();
            mostrarLibros();
        }

function buscarLibroAdmin() {
    const texto = document.getElementById("buscador-admin")
        .value.toLowerCase().trim();

    const contenedor = document.getElementById("lista-libros-admin");

    if (!texto) {
        contenedor.innerHTML = "";
        return;
    }

    const resultados = libros
        .map((libro, indice) => ({ libro, indice }))
        .filter(({ libro }) => {
            const datos = [
                libro.titulo,
                libro.autor,
                libro.materia,
                libro.serie,
                libro.clasificacion,
                libro.id
            ];

            return datos.some(valor =>
                String(valor ?? "").toLowerCase().includes(texto)
            );
        })
        .slice(0, LIMITE_RESULTADOS_ADMIN);

    mostrarListaAdmin(resultados);
}

function mostrarListaAdmin(lista) {
    const contenedor = document.getElementById("lista-libros-admin");

    contenedor.innerHTML = "";

    lista.forEach(({ libro, indice }) => {
        const elemento = document.createElement("div");

        elemento.className = "item-admin";

        elemento.innerHTML = `
            <img
                src="${escaparHTML(libro.imagenPortada || libro.ImagenPortada || libro.imagen || '')}"
                alt="${escaparHTML(libro.titulo)}">

            <div class="datos-admin">
                <h4>${escaparHTML(libro.titulo)}</h4>

                <p>
                    <strong>Número de serie:</strong>
                    ${escaparHTML(libro.serie)}
                </p>

                <p>
                    <strong>Autor:</strong>
                    ${escaparHTML(libro.autor)}
                </p>

                <p>
                    <strong>Clasificación:</strong>
                    ${escaparHTML(libro.clasificacion)}
                </p>
            </div>

            <div class="acciones-admin">
                <button
                    class="btn-editar"
                    onclick="editarLibro(${indice})">
                    ✏️ Editar
                </button>

                <button
                    class="btn-eliminar"
                    onclick="eliminarLibro(${indice})">
                    🗑️ Eliminar
                </button>
            </div>
        `;

        const imagen = elemento.querySelector("img");

        imagen.onerror = () => {
            imagen.onerror = null;
            imagen.src = "https://placehold.co/300x420?text=Libro";
        };

        contenedor.appendChild(elemento);
    });
}


// GUARDAR CAMBIOS ADMINISTRATIVOS LOCALES


function guardarEnLocalStorage() {
    localStorage.setItem(
        "catalogoFrayServando",
        JSON.stringify(libros)
    );
}


async function guardarLibro() {
    const titulo = document.getElementById("admin-titulo").value.trim();
    const autor = document.getElementById("admin-autor").value.trim();
    const materia = document.getElementById("admin-materia").value.trim();
    const serie = document.getElementById("admin-serie").value.trim();
    const descripcion = document.getElementById("admin-descripcion").value.trim();
    const imagenPortada = document.getElementById("admin-imagen").value.trim();
    const indice = document.getElementById("indice-libro").value;

    if (!titulo || !autor || !serie) {
        alert("Completa al menos el título, el autor y el número de serie.");
        return;
    }

    const editando = indice !== "";
    const libroExistente = editando ? libros[Number(indice)] : null;

    if (editando && !libroExistente) {
        alert("No se encontró el libro que deseas editar.");
        return;
    }

    const datosLibro = {
    titulo,
    autor,
    materia,
    serie,
    descripcion,
    imagenPortada
};

    try {
        const url = editando
            ? `/api/libros/${libroExistente.id}`
            : "/api/libros";

        const respuesta = await fetch(url, {
            method: editando ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datosLibro)
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo guardar el libro.");
        }

        alert(editando
            ? "¡Libro actualizado correctamente!"
            : `¡Libro agregado correctamente! ID: ${resultado.id}`
        );

        await cargarLibrosDesdeBD();

        cancelarEdicion();
        buscarLibroAdmin();

    } catch (error) {
        console.error("Error al guardar libro:", error);
        alert(error.message);
    }
}



function editarLibro(indice) {
    const libro = libros[indice];

    if (!libro) return;

    document.getElementById("indice-libro").value = indice;
    document.getElementById("admin-titulo").value = libro.titulo;
    document.getElementById("admin-autor").value = libro.autor;
    document.getElementById("admin-materia").value = libro.materia;
    document.getElementById("admin-serie").value = libro.serie;
   document.getElementById("admin-imagen").value =
    libro.imagenPortada ?? libro.ImagenPortada ?? libro.imagen ?? "";
    document.getElementById("admin-descripcion").value = libro.descripcion;

    document.getElementById("titulo-formulario").textContent =
        "Editar libro";

    document.querySelector(".formulario-admin")?.scrollIntoView({
        behavior: "smooth"
    });
}

async function eliminarLibro(indice) {
    const libro = libros[indice];

    if (!libro) {
        alert("No se encontró el libro.");
        return;
    }

    const confirmar = confirm(
        `¿Seguro que quieres eliminar "${libro.titulo}"? Esta acción también lo eliminará de MySQL.`
    );

    if (!confirmar) return;

    try {
        const respuesta = await fetch(`/api/libros/${libro.id}`, {
            method: "DELETE"
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.error || "No se pudo eliminar el libro."
            );
        }

        alert("¡Libro eliminado correctamente!");

        await cargarLibrosDesdeBD();

        cancelarEdicion();
        buscarLibroAdmin();

    } catch (error) {
        console.error("Error al eliminar libro:", error);
        alert(error.message);
    }
}


function cancelarEdicion() {
    const campos = [
        "indice-libro",
        "admin-titulo",
        "admin-autor",
        "admin-materia",
        "admin-serie",
        "admin-imagen",
        "admin-descripcion"
    ];

    campos.forEach(id => {
        const campo = document.getElementById(id);

        if (campo) {
            campo.value = "";
        }
    });

    const titulo = document.getElementById("titulo-formulario");

    if (titulo) {
        titulo.textContent = "Agregar nuevo libro";
    }
}


 // SOLICITUDES DE LIBROS

function abrirSolicitudes() {
    document.getElementById("formulario-solicitud").reset();

    document.getElementById("mensaje-solicitud").textContent = "";

    ventanaSolicitudes.style.display = "flex";
}

function cerrarSolicitudes() {
    ventanaSolicitudes.style.display = "none";
}

/* MOSTRAR SOLICITUDES A LOS ENCARGADOS */
async function cargarSolicitudes() {
    const contenedor = document.getElementById("lista-solicitudes-admin");

    contenedor.innerHTML = "<p>Cargando solicitudes...</p>";

    try {
        const respuesta = await fetch("/api/solicitudes");

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar las solicitudes.");
        }

        const solicitudes = await respuesta.json();

        contenedor.innerHTML = "";

        if (solicitudes.length === 0) {
            contenedor.innerHTML = "<p>No hay solicitudes recibidas.</p>";
            return;
        }


solicitudes.forEach(solicitud => {
    const elemento = document.createElement("div");

    elemento.className = "item-admin";

    elemento.innerHTML = `
        <div class="datos-admin">
            <h4>${escaparHTML(solicitud.titulo)}</h4>

            <p><strong>Autor:</strong> ${escaparHTML(solicitud.autor)}</p>

            <p><strong>Editorial:</strong> ${escaparHTML(solicitud.editorial || "No especificada")}</p>

            <p><strong>Comentarios:</strong> ${escaparHTML(solicitud.comentarios || "Sin comentarios")}</p>

            <p><strong>Fecha:</strong> ${escaparHTML(solicitud.fecha_solicitud)}</p>

            <p><strong>Estado:</strong>
                <span class="estado-solicitud">
                    ${escaparHTML(solicitud.estado)}
                </span>
            </p>

        ${
    solicitud.estado === "Pendiente"
    ?`
        <div class="botones-solicitud">

            <button
                class="btn-confirmar"
                onclick="actualizarEstadoSolicitud(${Number(solicitud.id)}, 'Confirmada')">
                ✓ Confirmar
            </button>

            <button
                class="btn-rechazar"
                onclick="actualizarEstadoSolicitud(${Number(solicitud.id)}, 'Rechazada')">
                ✕ Rechazar
            </button>

        </div>
    `
    : ""
 }
            `;

    contenedor.appendChild(elemento);
});

    } catch (error) {
        console.error("Error al cargar solicitudes:", error);

        contenedor.innerHTML =
            "<p>No se pudieron cargar las solicitudes.</p>";
    }
}


// ENVIAR SOLICITUD A MYSQL
document.getElementById("formulario-solicitud").addEventListener("submit", async function(event) {

    event.preventDefault();

    const titulo = document.getElementById("solicitud-titulo").value.trim();
    const autor = document.getElementById("solicitud-autor").value.trim();
    const editorial = document.getElementById("solicitud-editorial").value.trim();
    const comentarios = document.getElementById("solicitud-comentarios").value.trim();

    const mensaje = document.getElementById("mensaje-solicitud");

    mensaje.textContent = "Enviando solicitud...";

    try {

        const respuesta = await fetch("/api/solicitudes", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                titulo,
                autor,
                editorial,
                comentarios
            })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo enviar la solicitud.");
        }

        mensaje.textContent = "¡Solicitud enviada correctamente!";

        document.getElementById("formulario-solicitud").reset();

    } catch (error) {

    console.error("Error al enviar solicitud:", error);

    mensaje.textContent = "Error: " + error.message;
}


});

// CONFIRMAR O RECHAZAR SOLICITUDES


async function actualizarEstadoSolicitud(id, estado) {

    const confirmacion = confirm(
        `¿Estás seguro de que deseas ${estado.toLowerCase()} esta solicitud?`
    );

    if (!confirmacion) return;

    try {

        const respuesta = await fetch(`/api/solicitudes/${id}/estado`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ estado })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultado.error || "No se pudo actualizar.");
        }

        alert(resultado.mensaje);

        // Recargar las solicitudes para mostrar el nuevo estado
        cargarSolicitudes();

    } catch (error) {

        console.error("Error al actualizar solicitud:", error);

        alert("No se pudo actualizar la solicitud.");
    }
}



// CERRAR VENTANAS

window.addEventListener("click", event => {
    if (event.target === ventanaLibro) {
        cerrarLibro();
    }

    if (event.target === ventanaLogin) {
        cerrarLogin();
    }
    if (event.target === ventanaSolicitudes) {
    cerrarSolicitudes();
}
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        cerrarLibro();
        cerrarLogin();
        cerrarSolicitudes();
    }
});


// INICIAR CATÁLOGO

cargarLibrosDesdeBD();


// MOSTRAR LIBROS MÁS BUSCADOS


async function mostrarMasBuscados() {
    try {
        const respuesta = await fetch("/api/libros-mas-buscados");
        const resultados = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(resultados.error || "Error al obtener los libros.");
        }

        if (resultados.length === 0) {
            alert("Todavía no hay libros más buscados.");
            return;
        }

        const ids = resultados.map(libro => Number(libro.ID));

        const populares = libros.filter(libro =>
            ids.includes(Number(libro.id))
        );

        mostrarLibros(populares);

    } catch (error) {
        console.error(error);
        alert("No se pudieron cargar los libros más buscados.");
    }
}


// MOSTRAR ESTADÍSTICAS DE LIBROS


let graficaBarras = null;
let graficaCircular = null;
let graficaMaterias = null;

async function mostrarEstadisticas() {
    try {
        const respuesta = await fetch("/api/estadisticas-libros");
        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(datos.error || "Error al cargar estadísticas");
        }

        if (datos.libros.length === 0) {
            alert("Todavía no hay estadísticas de libros.");
            return;
        }

        // Mostrar la sección de estadísticas
        document.getElementById("seccion-estadisticas").style.display = "block";

        // Mostrar total de aperturas
        document.getElementById("total-aperturas").textContent =
            "Total de libros abiertos: " + datos.total;

        // Obtener títulos y cantidades
        const titulos = datos.libros.map(libro => libro.Titulo);
        const cantidades = datos.libros.map(libro => libro.cantidad);

        // GRÁFICA DE BARRAS


        const contextoBarras = document
            .getElementById("grafica-barras")
            .getContext("2d");

        if (graficaBarras) {
            graficaBarras.destroy();
        }

        graficaBarras = new Chart(contextoBarras, {
            type: "bar",
            data: {
                labels: titulos,
                datasets: [{
                    label: "Veces abierto",
                    data: cantidades,
                    backgroundColor: "rgba(54, 162, 235, 0.6)",
                    borderColor: "rgb(54, 162, 235)",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                indexAxis: "y",
                scales: {
                    x: {
                        beginAtZero: true
                    }
                }
            }
        });

        // GRÁFICA CIRCULAR
 
        const contextoCircular = document
            .getElementById("grafica-circular")
            .getContext("2d");

        if (graficaCircular) {
            graficaCircular.destroy();
        }

        graficaCircular = new Chart(contextoCircular, {
            type: "pie",
            data: {
                labels: titulos,
                datasets: [{
                    label: "Porcentaje de visitas",
                    data: cantidades
                }]
            },
            options: {
                responsive: true
            }
        });
  
        // GRÁFICA DE MATERIAS
       

        const nombresMaterias = datos.materias.map(
            materia => materia.Materias || "Sin materia"
        );

        const visitasMaterias = datos.materias.map(
            materia => Number(materia.cantidad)
        );

        const contextoMaterias = document
            .getElementById("grafica-materias")
            .getContext("2d");

        if (graficaMaterias) {
            graficaMaterias.destroy();
        }

        graficaMaterias = new Chart(contextoMaterias, {
            type: "bar",
            data: {
                labels: nombresMaterias,
                datasets: [{
                    label: "Visitas por materia",
                    data: visitasMaterias,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                indexAxis: "y",
                scales: {
                    x: {
                        beginAtZero: true
                    }
                }
            }
        });

    } catch (error) {
        console.error("Error:", error);
        alert("No se pudieron cargar las estadísticas.");
    }
}


function cerrarEstadisticas() {
    document.getElementById("seccion-estadisticas").style.display = "none";
}


// Abrir y cerrar el buscador
function alternarBuscadorMovil() {
    const acciones = document.querySelector(".acciones-header");
    const buscador = document.getElementById("buscador");

    acciones.classList.toggle("buscador-abierto");

    if (acciones.classList.contains("buscador-abierto")) {
        buscador.focus();
    }
}

// Abrir y cerrar el menú
function alternarMenuMovil() {
    const menu = document.getElementById("menu-movil");

    menu.classList.toggle("abierto");
}

// Cerrar el menú al seleccionar una opción
document.addEventListener("DOMContentLoaded", function () {
    const menu = document.getElementById("menu-movil");

    if (menu) {
        menu.addEventListener("click", function (event) {
            if (event.target.closest("button")) {
                menu.classList.remove("abierto");
            }
        });
    }
});

// MOSTRAR Y MINIMIZAR SOLICITUDES


function alternarSolicitudes() {
    const lista = document.getElementById("lista-solicitudes-admin");
    const boton = document.getElementById("btn-toggle-solicitudes");

    if (!lista || !boton) return;

    const estaVisible = lista.style.display === "block";

    if (estaVisible) {
        // Minimizar solicitudes
        lista.style.display = "none";
        boton.textContent = "Ver solicitudes recibidas";
    } else {
        // Mostrar solicitudes
        lista.style.display = "block";
        boton.textContent = "Ocultar solicitudes";

        cargarSolicitudes();
    }
}
