document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    // Elementos del HTML original
    const contenedorCentral = document.getElementById('moduls-container'); 
    const contenedorIndice = document.getElementById('course-index'); // La barra izquierda
    const tituloCursEl = document.getElementById('curs-titol');     
    const descripcioCursEl = document.getElementById('curs-descripcio'); 
    const btnLateral = document.getElementById('finish-review'); 

    if (!slug) return;

    // Estado
    let respuestasUsuario = {}; 
    let datosCursoGlobal = null;

    cargarDatos();

    async function cargarDatos() {
        try {
            const response = await fetch(`/.netlify/functions/dadesCurs?slug=${slug}`);
            if (!response.ok) throw new Error('Error servidor');
            const data = await response.json();
            datosCursoGlobal = data;
            renderizarTodo(data);
        } catch (error) {
            console.error(error);
            contenedorCentral.innerHTML = '<div class="alert alert-danger">Error carregant dades.</div>';
        }
    }

    function renderizarTodo(data) {
        // 1. Cabecera y Descripción (Arreglado el [object Object])
        if(tituloCursEl) tituloCursEl.textContent = data.titol;
        if(descripcioCursEl) {
            // Si es texto enriquecido (bloques), extraemos el texto. Si es string, lo ponemos tal cual.
            if (Array.isArray(data.descripcio)) {
                descripcioCursEl.innerText = data.descripcio.map(b => b.children.map(c => c.text).join('')).join('\n');
            } else {
                descripcioCursEl.innerText = data.descripcio || "";
            }
        }

        // 2. Limpiar contenedores
        contenedorCentral.innerHTML = '';
        if(contenedorIndice) contenedorIndice.innerHTML = '';

        // 3. Bucle de Módulos
        if (data.moduls && data.moduls.length > 0) {
            data.moduls.forEach((modul, idx) => {
                // A. Rellenar Índice Lateral (Lo que faltaba antes)
                if(contenedorIndice) {
                    const item = document.createElement('div');
                    item.className = 'module-item';
                    item.innerHTML = `<a href="#modul-${idx}" class="text-decoration-none text-dark">📂 ${modul.titol}</a>`;
                    contenedorIndice.appendChild(item);
                }

                // B. Renderizar Contenido Central
                renderizarModuloCentral(modul, idx);
            });

            // 4. AÑADIR BOTÓN FINAL (El que tú querías abajo)
            const divBoton = document.createElement('div');
            divBoton.className = 'text-center mt-5 mb-5';
            divBoton.innerHTML = `
                <button id="btn-entregar-final" class="btn btn-primary btn-lg px-5">
                    <i class="fas fa-check-circle"></i> Entregar i Corregir
                </button>
            `;
            contenedorCentral.appendChild(divBoton);

            // Activar el botón de abajo
            document.getElementById('btn-entregar-final').addEventListener('click', corregirExamen);
        }

        // Activar también el botón lateral si existe
        if(btnLateral) btnLateral.addEventListener('click', (e) => {
            e.preventDefault();
            corregirExamen();
        });
    }

    function renderizarModuloCentral(modul, indexModul) {
        // Título del módulo
        const tituloMod = document.createElement('h3');
        tituloMod.id = `modul-${indexModul}`;
        tituloMod.className = 'mt-4 mb-3 border-bottom pb-2';
        tituloMod.textContent = modul.titol;
        contenedorCentral.appendChild(tituloMod);

        const preguntas = modul.preguntes || [];

        preguntas.forEach((preg, indexPreg) => {
            const pid = `m${indexModul}-p${indexPreg}`;
            
            const card = document.createElement('div');
            card.className = 'card mb-4 shadow-sm'; // Estilo clásico de Bootstrap/Moodle
            card.dataset.id = pid;

            // Texto enunciado
            const textoEnunciado = preg.text || preg.titol || "Sense enunciat";

            // Explicación (Lógica arreglada Rich Text)
            let textoExpli = "Sense explicació.";
            if(preg.explicacio) {
                if(Array.isArray(preg.explicacio)) {
                    textoExpli = preg.explicacio.map(b => b.children.map(c => c.text).join('')).join('<br>');
                } else {
                    textoExpli = preg.explicacio;
                }
            }

            // HTML CLÁSICO (Con letras a., b., c.)
            let htmlOpciones = '';
            const letras = ['a', 'b', 'c', 'd'];
            
            if(preg.opcions) {
                preg.opcions.forEach((op, i) => {
                    const letra = letras[i] || '-';
                    htmlOpciones += `
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="radio" name="resp-${pid}" id="opt-${pid}-${i}" value="${i}">
                            <label class="form-check-label" for="opt-${pid}-${i}">
                                <strong>${letra}.</strong> ${op.text}
                            </label>
                        </div>
                    `;
                });
            }

            card.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title text-muted">Pregunta ${indexPreg + 1}</h5>
                    <div class="card-text fs-5 mb-3">${textoEnunciado}</div>
                    <div class="opciones-area ml-3">
                        ${htmlOpciones}
                    </div>
                    <!-- Caja amarilla clásica -->
                    <div id="feedback-${pid}" class="mt-3 p-3" style="display:none; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 5px;">
                        <strong>Explicació:</strong><br>
                        <span>${textoExpli}</span>
                    </div>
                </div>
            `;

            contenedorCentral.appendChild(card);

            // Escuchar cambios
            const inputs = card.querySelectorAll('input');
            inputs.forEach(inp => {
                inp.addEventListener('change', () => {
                    respuestasUsuario[pid] = inp.value;
                });
            });
        });
    }

    function corregirExamen() {
        if (!datosCursoGlobal) return;
        let aciertos = 0;
        let total = 0;

        datosCursoGlobal.moduls.forEach((modul, im) => {
            (modul.preguntes || []).forEach((preg, ip) => {
                total++;
                const pid = `m${im}-p${ip}`;
                const userVal = respuestasUsuario[pid];
                
                // Buscar correcta
                let correctIdx = -1;
                preg.opcions.forEach((o, i) => { if(o.esCorrecta) correctIdx = i; });

                const card = document.querySelector(`div[data-id="${pid}"]`);
                if(!card) return;

                const feedback = document.getElementById(`feedback-${pid}`);
                if(feedback) feedback.style.display = 'block'; // Mostrar caja amarilla

                const labels = card.querySelectorAll('label');
                const inputs = card.querySelectorAll('input');

                // Marcar visualmente
                if(correctIdx !== -1 && labels[correctIdx]) {
                    labels[correctIdx].classList.add('text-success');
                    labels[correctIdx].style.fontWeight = 'bold';
                }

                if(userVal !== undefined) {
                    if(parseInt(userVal) === correctIdx) {
                        aciertos++;
                        // Estilo Moodle: fondo verde suave a la tarjeta
                        card.style.backgroundColor = '#d1e7dd';
                        card.style.borderColor = '#badbcc';
                    } else {
                        // Fallo
                        card.style.backgroundColor = '#f8d7da';
                        card.style.borderColor = '#f5c6cb';
                        if(labels[userVal]) labels[userVal].style.textDecoration = 'line-through';
                    }
                }

                // Bloquear
                inputs.forEach(i => i.disabled = true);
            });
        });

        alert(`Nota Final: ${((aciertos/total)*10).toFixed(2)}`);
        window.scrollTo(0,0);
    }
});