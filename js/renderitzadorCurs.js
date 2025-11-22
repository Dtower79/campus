document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    // --- ADAPTACIÓN A TU HTML ---
    const contenedor = document.getElementById('moduls-container'); // Nombre real en tu HTML
    const tituloCursEl = document.getElementById('curs-titol');     // Nombre real en tu HTML
    const descripcioCursEl = document.getElementById('curs-descripcio'); // Nombre real en tu HTML
    const btnCorregir = document.getElementById('finish-review');   // El botón de la barra lateral

    if (!slug) {
        console.error('No se ha especificado ningún curso.');
        if(tituloCursEl) tituloCursEl.textContent = "Error: Curs no especificat";
        return;
    }

    // Variables globales
    let respuestasUsuario = {}; 
    let datosCursoGlobal = null;

    cargarDatosCurso(slug);

    async function cargarDatosCurso(slug) {
        try {
            // Llamada al backend
            const response = await fetch(`/.netlify/functions/dadesCurs?slug=${slug}`);
            
            if (!response.ok) throw new Error('Error al cargar el curso');

            const data = await response.json();
            datosCursoGlobal = data;
            
            renderizarCurso(data);

        } catch (error) {
            console.error('Error:', error);
            if(contenedor) contenedor.innerHTML = `<div class="alert alert-danger">Error de connexió: ${error.message}</div>`;
        }
    }

    function renderizarCurso(data) {
        // 1. Rellenar cabecera del HTML existente
        if(tituloCursEl) tituloCursEl.textContent = data.titol;
        if(descripcioCursEl) descripcioCursEl.textContent = data.descripcio || "";

        // 2. Limpiar contenedor de módulos
        contenedor.innerHTML = '';

        // 3. Renderizar Módulos
        if (data.moduls && data.moduls.length > 0) {
            data.moduls.forEach((modul, indexModul) => {
                renderizarModul(modul, indexModul);
            });
        } else {
            contenedor.innerHTML = '<p>Aquest curs no té mòduls disponibles.</p>';
        }
    }

    function renderizarModul(modul, indexModul) {
        // Crear contenedor del módulo
        const divModul = document.createElement('div');
        divModul.classList.add('modul-section', 'mb-5'); // Usamos clases genéricas
        
        // Título del módulo
        divModul.innerHTML = `<h3 class="mb-3 border-bottom pb-2">${modul.titol}</h3>`;

        const preguntas = modul.preguntes || [];
        
        if (preguntas.length === 0) {
            divModul.innerHTML += '<p class="text-muted">No hi ha preguntes.</p>';
        }

        preguntas.forEach((pregunta, indexPregunta) => {
            const preguntaId = `m${indexModul}-p${indexPregunta}`;
            
            const divPregunta = document.createElement('div');
            divPregunta.classList.add('card', 'mb-4', 'pregunta-card');
            divPregunta.dataset.id = preguntaId;

            // --- ENUNCIADO ---
            const enunciadoTexto = pregunta.text || pregunta.titol || "Pregunta sense enunciat";

            // --- EXPLICACIÓN (Lógica Rich Text v5) ---
            let explicacionTexto = "Sense explicació addicional.";
            if (pregunta.explicacio) {
                if (Array.isArray(pregunta.explicacio)) {
                    try {
                        // Extraer texto de bloques
                        const textoBloques = pregunta.explicacio
                            .map(b => (b.children ? b.children.map(c => c.text).join('') : ''))
                            .join('<br>');
                        if(textoBloques.trim()) explicacionTexto = textoBloques;
                    } catch (e) { console.warn("Error Rich Text", e); }
                } else if (typeof pregunta.explicacio === 'string' && pregunta.explicacio.trim()) {
                    explicacionTexto = pregunta.explicacio;
                }
            }

            // HTML de la tarjeta
            divPregunta.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title text-muted fs-6">Pregunta ${indexPregunta + 1}</h5>
                    <p class="card-text fs-5 fw-bold mb-3">${enunciadoTexto}</p>
                    
                    <div class="opciones-list" id="opciones-${preguntaId}">
                        <!-- Opciones -->
                    </div>

                    <!-- Explicación (Oculta) -->
                    <div class="feedback-box mt-3 p-3 bg-light border rounded" style="display:none;" id="feedback-${preguntaId}">
                        <strong class="text-primary">Explicació:</strong><br>
                        <span class="text-dark">${explicacionTexto}</span>
                    </div>
                </div>
            `;

            // --- OPCIONES ---
            const divOpciones = divPregunta.querySelector(`#opciones-${preguntaId}`);
            const opcionesList = pregunta.opcions || [];

            if (opcionesList.length > 0) {
                opcionesList.forEach((opcio, indexOpcion) => {
                    const divOpcion = document.createElement('div');
                    divOpcion.classList.add('form-check', 'mb-2', 'p-2', 'opcion-wrapper');
                    
                    const inputId = `opt-${preguntaId}-${indexOpcion}`;
                    
                    divOpcion.innerHTML = `
                        <input class="form-check-input" type="radio" name="respuesta-${preguntaId}" id="${inputId}" value="${indexOpcion}">
                        <label class="form-check-label w-100" for="${inputId}" style="cursor:pointer;">
                            ${opcio.text || "..."}
                        </label>
                    `;
                    
                    // Listener respuesta
                    divOpcion.querySelector('input').addEventListener('change', () => {
                        respuestasUsuario[preguntaId] = indexOpcion;
                        // Limpiar estilos previos
                        divOpciones.querySelectorAll('.opcion-wrapper').forEach(el => el.style.backgroundColor = 'transparent');
                        // Marcar actual
                        divOpcion.style.backgroundColor = '#e9ecef'; 
                    });

                    divOpciones.appendChild(divOpcion);
                });
            }

            divModul.appendChild(divPregunta);
        });

        contenedor.appendChild(divModul);
    }

    // --- CORRECCIÓN ---
    if (btnCorregir) {
        btnCorregir.addEventListener('click', (e) => {
            e.preventDefault(); // Evitar que el enlace recargue la página
            if (!datosCursoGlobal) return;

            let aciertos = 0;
            let total = 0;

            datosCursoGlobal.moduls.forEach((modul, idxM) => {
                const pregs = modul.preguntes || [];
                pregs.forEach((preg, idxP) => {
                    total++;
                    const pId = `m${idxM}-p${idxP}`;
                    const userIdx = respuestasUsuario[pId];
                    
                    const card = document.querySelector(`div[data-id="${pId}"]`);
                    const feedback = document.getElementById(`feedback-${pId}`);
                    if(feedback) feedback.style.display = 'block';

                    // Buscar correcta
                    let correctIdx = -1;
                    if(preg.opcions) preg.opcions.forEach((o, i) => { if(o.esCorrecta) correctIdx = i; });

                    const labels = card.querySelectorAll('label');
                    const wrappers = card.querySelectorAll('.opcion-wrapper');
                    const inputs = card.querySelectorAll('input');

                    // Marcar correcta (Verde)
                    if(correctIdx !== -1 && wrappers[correctIdx]) {
                        wrappers[correctIdx].style.backgroundColor = '#d1e7dd'; // Verde claro
                        labels[correctIdx].classList.add('text-success', 'fw-bold');
                    }

                    // Evaluar usuario
                    if(userIdx !== undefined) {
                        if(parseInt(userIdx) === correctIdx) {
                            aciertos++;
                            card.style.borderLeft = "5px solid green";
                        } else {
                            card.style.borderLeft = "5px solid red";
                            if(wrappers[userIdx]) {
                                wrappers[userIdx].style.backgroundColor = '#f8d7da'; // Rojo claro
                                labels[userIdx].style.textDecoration = "line-through";
                            }
                        }
                    } else {
                        card.style.borderLeft = "5px solid orange";
                    }

                    // Bloquear
                    inputs.forEach(i => i.disabled = true);
                });
            });

            const nota = total > 0 ? (aciertos / total) * 10 : 0;
            alert(`Resultat: ${aciertos}/${total}\nNota: ${nota.toFixed(2)}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});