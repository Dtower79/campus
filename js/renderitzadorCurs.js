document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug'); // Obtener el slug de la URL
    const contenedor = document.getElementById('contenedor-examen');
    const btnCorregir = document.getElementById('btn-corregir');

    if (!slug) {
        console.error('No se ha especificado ningún curso.');
        if(contenedor) contenedor.innerHTML = '<div class="alert alert-warning">No s\'ha especificat cap curs.</div>';
        return;
    }

    cargarDatosCurso(slug);

    // Variables globales para la corrección
    let respuestasUsuario = {}; 
    let datosCursoGlobal = null;

    async function cargarDatosCurso(slug) {
        try {
            // Llamada a la función de Netlify (Middleware)
            const response = await fetch(`/.netlify/functions/dadesCurs?slug=${slug}`);
            
            if (!response.ok) throw new Error('Error al cargar el curso');

            const data = await response.json();
            datosCursoGlobal = data; // Guardamos los datos para corregir después
            
            renderizarCurso(data);

        } catch (error) {
            console.error('Error:', error);
            if(contenedor) contenedor.innerHTML = `<div class="alert alert-danger">Error carregant el curs. Revisa la connexió o l'URL.</div>`;
        }
    }

    function renderizarCurso(data) {
        contenedor.innerHTML = '';

        // Título del curso
        const titulo = document.createElement('h1');
        titulo.classList.add('mb-4');
        titulo.textContent = data.titol;
        contenedor.appendChild(titulo);

        // Renderizar Módulos
        if (data.moduls && data.moduls.length > 0) {
            data.moduls.forEach((modul, indexModul) => {
                renderizarModul(modul, indexModul);
            });
        } else {
            contenedor.innerHTML += '<p>Aquest curs no té mòduls disponibles.</p>';
        }
        
        // Mostrar botón corregir si hay preguntas
        if (btnCorregir) btnCorregir.style.display = 'block';
    }

    function renderizarModul(modul, indexModul) {
        const divModul = document.createElement('div');
        divModul.classList.add('modul-container', 'mb-5');
        
        divModul.innerHTML = `<h3 class="mb-3 text-primary border-bottom pb-2">${modul.titol}</h3>`;

        // Strapi v5: El campo suele llamarse 'preguntes' (Zona dinámica/Componente)
        const preguntas = modul.preguntes || [];
        
        if (preguntas.length === 0) {
            divModul.innerHTML += '<p class="text-muted">No hi ha preguntes en aquest mòdul.</p>';
        }

        preguntas.forEach((pregunta, indexPregunta) => {
            // ID único: m0-p1 (Módulo 0, Pregunta 1)
            const preguntaId = `m${indexModul}-p${indexPregunta}`;
            
            const divPregunta = document.createElement('div');
            divPregunta.classList.add('card', 'mb-4', 'pregunta-card', 'shadow-sm');
            divPregunta.dataset.id = preguntaId;

            // --- 1. ENUNCIADO ---
            // Intentamos leer 'text' (nuevo), si no 'titol' (viejo)
            const enunciadoTexto = pregunta.text || pregunta.titol || "Pregunta sense enunciat";

            // --- 2. EXPLICACIÓN (SOPORTE RICH TEXT v5) ---
            let explicacionTexto = "Sense explicació addicional.";

            if (pregunta.explicacio) {
                if (Array.isArray(pregunta.explicacio)) {
                    // Es formato Bloques de Strapi v5
                    try {
                        // Extraemos el texto de los párrafos
                        const textoExtraido = pregunta.explicacio
                            .map(bloque => {
                                if (bloque.children) {
                                    return bloque.children.map(child => child.text).join('');
                                }
                                return '';
                            })
                            .join('<br>');
                        
                        if(textoExtraido.trim().length > 0) explicacionTexto = textoExtraido;
                    } catch (e) {
                        console.warn("Error parseando rich text", e);
                    }
                } else if (typeof pregunta.explicacio === 'string' && pregunta.explicacio.trim().length > 0) {
                    // Es texto plano antiguo
                    explicacionTexto = pregunta.explicacio;
                }
            }

            // HTML Estructura de la Pregunta
            divPregunta.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <h5 class="card-title text-secondary">Pregunta ${indexPregunta + 1}</h5>
                    </div>
                    
                    <p class="card-text fs-5 mb-3 fw-medium">${enunciadoTexto}</p>
                    
                    <div class="opciones-container ml-3" id="opciones-${preguntaId}">
                        <!-- Opciones se insertan aquí -->
                    </div>

                    <!-- CAJA DE EXPLICACIÓN (Oculta hasta corregir) -->
                    <div class="feedback-zone mt-3 animate__animated animate__fadeIn" style="display:none;" id="feedback-${preguntaId}">
                        <div class="alert alert-warning border-warning">
                            <strong>Explicació:</strong><br>
                            ${explicacionTexto}
                        </div>
                    </div>
                </div>
            `;

            // --- 3. OPCIONES ---
            const divOpciones = divPregunta.querySelector(`#opciones-${preguntaId}`);
            
            // Mapeo seguro de opciones (por si vienen como 'opcions' o 'respuestas')
            const opcionesList = pregunta.opcions || [];

            if (opcionesList.length > 0) {
                opcionesList.forEach((opcio, indexOpcion) => {
                    const divOpcion = document.createElement('div');
                    divOpcion.classList.add('form-check', 'mb-2', 'p-2', 'rounded', 'opcion-item');
                    
                    const inputId = `opt-${preguntaId}-${indexOpcion}`;
                    
                    // HTML del Radio Button
                    divOpcion.innerHTML = `
                        <input class="form-check-input" type="radio" name="respuesta-${preguntaId}" id="${inputId}" value="${indexOpcion}">
                        <label class="form-check-label w-100 cursor-pointer" for="${inputId}">
                            ${opcio.text || "Opció sense text"}
                        </label>
                    `;
                    
                    // Listener para guardar la respuesta
                    const input = divOpcion.querySelector('input');
                    input.addEventListener('change', () => {
                        respuestasUsuario[preguntaId] = indexOpcion;
                        
                        // Efecto visual de selección (opcional)
                        // Limpiar selección previa en este grupo
                        const hermanos = divOpciones.querySelectorAll('.opcion-item');
                        hermanos.forEach(h => h.classList.remove('bg-light-blue'));
                        // Marcar actual
                        divOpcion.classList.add('bg-light-blue');
                    });

                    divOpciones.appendChild(divOpcion);
                });
            }

            divModul.appendChild(divPregunta);
        });

        contenedor.appendChild(divModul);
    }

    // --- 4. LÓGICA DE CORRECCIÓN ---
    if (btnCorregir) {
        btnCorregir.addEventListener('click', () => {
            if (!datosCursoGlobal) return;

            let aciertos = 0;
            let totalPreguntas = 0;
            let contestadas = 0;

            datosCursoGlobal.moduls.forEach((modul, indexModul) => {
                const preguntas = modul.preguntes || [];
                
                preguntas.forEach((pregunta, indexPregunta) => {
                    totalPreguntas++;
                    const preguntaId = `m${indexModul}-p${indexPregunta}`;
                    const respuestaUserIndex = respuestasUsuario[preguntaId]; // Índice seleccionado (0, 1, 2, 3)
                    
                    const card = document.querySelector(`div[data-id="${preguntaId}"]`);
                    const feedbackDiv = document.getElementById(`feedback-${preguntaId}`);
                    
                    // Mostrar la caja de explicación
                    if(feedbackDiv) feedbackDiv.style.display = 'block';

                    // Encontrar el índice de la correcta
                    let indexCorrecta = -1;
                    if (pregunta.opcions) {
                        pregunta.opcions.forEach((opt, idx) => {
                            if (opt.esCorrecta) indexCorrecta = idx;
                        });
                    }

                    // Seleccionar todos los labels de esa tarjeta
                    const inputs = card.querySelectorAll('input');
                    const labels = card.querySelectorAll('label');
                    const divOpcionesItems = card.querySelectorAll('.opcion-item');

                    // 1. Marcar la respuesta CORRECTA en VERDE (Siempre)
                    if (indexCorrecta !== -1 && divOpcionesItems[indexCorrecta]) {
                        divOpcionesItems[indexCorrecta].classList.add('bg-success-subtle', 'border', 'border-success');
                        labels[indexCorrecta].classList.add('text-success', 'fw-bold');
                        labels[indexCorrecta].innerHTML += ' ✅';
                    }

                    // 2. Evaluar lo que hizo el usuario
                    if (respuestaUserIndex !== undefined) {
                        contestadas++;
                        
                        if (parseInt(respuestaUserIndex) === indexCorrecta) {
                            // ACIERTO
                            aciertos++;
                            card.classList.add('border-success', 'border-2');
                        } else {
                            // FALLO
                            card.classList.add('border-danger', 'border-2');
                            // Marcar la que marcó el usuario en ROJO
                            if (divOpcionesItems[respuestaUserIndex]) {
                                divOpcionesItems[respuestaUserIndex].classList.add('bg-danger-subtle');
                                labels[respuestaUserIndex].classList.add('text-danger', 'text-decoration-line-through');
                                labels[respuestaUserIndex].innerHTML += ' ❌';
                            }
                        }
                    } else {
                        // EN BLANCO
                        card.classList.add('border-warning');
                    }

                    // Bloquear inputs para no cambiar respuesta
                    inputs.forEach(inp => inp.disabled = true);
                });
            });

            // Calcular nota sobre 10
            const nota = totalPreguntas > 0 ? (aciertos / totalPreguntas) * 10 : 0;

            // Mostrar resultado (Alert o Modal)
            let mensaje = `Resultats:\n\nencertades: ${aciertos}\nTotals: ${totalPreguntas}\n\nNOTA FINAL: ${nota.toFixed(2)}`;
            alert(mensaje);
            
            // Subir al inicio suavemente
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});