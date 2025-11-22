document.addEventListener('DOMContentLoaded', () => {
    // 1. OBTENER PARÁMETROS URL
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    // 2. SELECCIÓN DE ELEMENTOS DOM (Coinciden con index.html)
    const contenedorCentral = document.getElementById('quiz-container'); // Antes: moduls-container
    const contenedorIndice = document.getElementById('course-index-content'); // Antes: course-index
    const contenedorGrid = document.getElementById('questions-grid'); // Antes: quiz-grid
    const tituloCursEl = document.getElementById('course-title'); // Antes: curs-titol
    
    // Opcional: Si decides añadir descripción en el HTML en el futuro
    const descripcioCursEl = document.getElementById('course-description'); 
    
    // OCULTAR enlace lateral si existe (Legacy)
    const linkLateral = document.getElementById('finish-review');
    if(linkLateral) linkLateral.style.display = 'none';

    // Si no hay slug, paramos
    if (!slug) return;

    // VARIABLES DE ESTADO
    let respuestasUsuario = {}; 
    let datosCursoGlobal = null;
    let totalPreguntasGlobal = 0;

    // INICIAR
    cargarDatos();

    async function cargarDatos() {
        try {
            // Llamada al Middleware de Netlify
            const response = await fetch(`/.netlify/functions/dadesCurs?slug=${slug}`);
            if (!response.ok) throw new Error('Error servidor');
            const data = await response.json();
            datosCursoGlobal = data;
            renderizarTodo(data);
        } catch (error) {
            console.error(error);
            if(contenedorCentral) {
                contenedorCentral.innerHTML = '<div class="alert alert-danger">Error carregant dades. Intenta recarregar la pàgina.</div>';
            }
        }
    }

    function renderizarTodo(data) {
        // Actualizar Cabecera
        if(tituloCursEl) tituloCursEl.textContent = data.titol;
        
        // Actualizar Descripción (si existe el elemento)
        if(descripcioCursEl) {
            if (Array.isArray(data.descripcio)) {
                descripcioCursEl.innerText = data.descripcio.map(b => b.children.map(c => c.text).join('')).join('\n');
            } else {
                descripcioCursEl.innerText = data.descripcio || "";
            }
        }

        // Limpiar contenedores
        if(contenedorCentral) contenedorCentral.innerHTML = '';
        if(contenedorIndice) contenedorIndice.innerHTML = '';
        if(contenedorGrid) contenedorGrid.innerHTML = '';

        totalPreguntasGlobal = 0;

        // Crear tarjeta de NOTA (oculta inicialmente)
        const scoreDiv = document.createElement('div');
        scoreDiv.id = 'final-score-card';
        scoreDiv.className = 'score-card';
        scoreDiv.style.display = 'none'; // Asegurar que nace oculta
        contenedorCentral.appendChild(scoreDiv);

        if (data.moduls && data.moduls.length > 0) {
            data.moduls.forEach((modul, idx) => {
                // A. Renderizar Índice Lateral
                if(contenedorIndice) {
                    const item = document.createElement('a');
                    item.className = 'module-link';
                    item.href = `#modul-${idx}`;
                    item.innerHTML = `<span class="icon">📁</span> ${modul.titol}`; // Icono simple si no hay FontAwesome
                    contenedorIndice.appendChild(item);
                }
                // B. Renderizar Módulo Central
                renderizarModuloCentral(modul, idx);
            });

            // CONFIGURAR EL BOTÓN DE ENTREGAR EXISTENTE EN EL HTML
            // Nota: El botón ya existe en el HTML, no lo creamos de nuevo, solo le damos funcionalidad.
            const btnExistente = document.getElementById('submit-exam');
            if(btnExistente) {
                btnExistente.addEventListener('click', corregirExamen);
            } else {
                // Fallback por si el HTML cambia: creamos uno dinámico
                const divBoton = document.createElement('div');
                divBoton.className = 'exam-actions';
                divBoton.innerHTML = `
                    <button id="btn-entregar-dinamico" class="btn-primary">
                        Entregar i Corregir
                    </button>
                `;
                contenedorCentral.appendChild(divBoton);
                document.getElementById('btn-entregar-dinamico').addEventListener('click', corregirExamen);
            }
            
            // Actualizar contador total de preguntas en la cabecera
            const countEl = document.getElementById('question-count');
            if(countEl) countEl.innerText = `${totalPreguntasGlobal} preguntes`;
        }
    }

    function renderizarModuloCentral(modul, indexModul) {
        // Título del Módulo dentro del examen
        const tituloMod = document.createElement('h3');
        tituloMod.id = `modul-${indexModul}`;
        tituloMod.className = 'module-title'; // Usar clase CSS si existe, sino hereda estilo
        tituloMod.style.marginTop = "30px";
        tituloMod.style.borderBottom = "2px solid var(--primary-color)";
        tituloMod.style.color = "var(--primary-color)";
        tituloMod.textContent = modul.titol;
        contenedorCentral.appendChild(tituloMod);

        const preguntas = modul.preguntes || [];

        preguntas.forEach((preg, indexPreg) => {
            totalPreguntasGlobal++; 
            const pid = `m${indexModul}-p${indexPreg}`;
            
            // --- GRID DERECHO (CUADRADOS) ---
            if(contenedorGrid) {
                const gridItem = document.createElement('div');
                gridItem.className = 'grid-item'; 
                gridItem.id = `grid-q-${pid}`;
                gridItem.textContent = totalPreguntasGlobal;
                
                gridItem.onclick = () => {
                    const card = document.querySelector(`[data-id="${pid}"]`);
                    if(card) card.scrollIntoView({behavior: "smooth", block: "center"});
                };
                contenedorGrid.appendChild(gridItem);
            }

            // --- TARJETA DE PREGUNTA ---
            const card = document.createElement('div');
            card.className = 'question-card';
            card.dataset.id = pid;

            // Procesar texto Enunciado
            const textoEnunciado = preg.text || preg.titol || "Sense enunciat";
            
            // Procesar texto Explicación (Rich Text o String)
            let textoExpli = "Sense explicació.";
            if(preg.explicacio) {
                if(Array.isArray(preg.explicacio)) {
                    textoExpli = preg.explicacio.map(b => b.children.map(c => c.text).join('')).join('<br>');
                } else {
                    textoExpli = preg.explicacio;
                }
            }

            const letras = ['a', 'b', 'c', 'd'];
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-list';

            if(preg.opcions) {
                preg.opcions.forEach((op, i) => {
                    const optRow = document.createElement('div');
                    optRow.className = 'option-item';
                    const inputId = `opt-${pid}-${i}`;
                    
                    optRow.innerHTML = `
                        <input type="radio" name="resp-${pid}" id="${inputId}" value="${i}" class="option-radio">
                        <label for="${inputId}" style="cursor:pointer; width:100%; display:block;">
                            <strong>${letras[i] || (i+1)}.</strong> ${op.text}
                        </label>
                    `;
                    
                    // Evento Change (Selección)
                    const radio = optRow.querySelector('input');
                    radio.addEventListener('change', () => {
                        respuestasUsuario[pid] = i;
                        
                        // Visuals: Gestión de clase .selected
                        optionsContainer.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
                        optRow.classList.add('selected');

                        // Grid Derecha (Marcar como contestada)
                        const gridEl = document.getElementById(`grid-q-${pid}`);
                        if(gridEl) gridEl.classList.add('answered');
                        
                        // Texto Estado en la tarjeta
                        const st = card.querySelector('.q-status');
                        if(st) {
                            st.innerText = "Resposta guardada";
                            st.style.color = "var(--primary-color)";
                        }
                    });

                    optionsContainer.appendChild(optRow);
                });
            }

            card.innerHTML = `
                <div class="q-header">
                    <span class="q-number">Pregunta ${totalPreguntasGlobal}</span>
                    <span class="q-status" style="font-size:0.85rem; color:#666;">Sense respondre</span>
                </div>
                <div class="q-body">
                    <div class="q-text">${textoEnunciado}</div>
                    <div class="options-area"></div>
                    <div id="feedback-${pid}" class="explanation-box" style="display:none;">
                        <strong>Explicació:</strong><br>
                        <span class="explanation-text">${textoExpli}</span>
                    </div>
                </div>
            `;
            
            card.querySelector('.options-area').appendChild(optionsContainer);
            contenedorCentral.appendChild(card);
        });
    }

    function corregirExamen() {
        if (!datosCursoGlobal) return;
        if (!confirm("Segur que vols entregar l'examen?")) return;

        let aciertos = 0;
        let total = 0;
        let contestadas = 0;

        datosCursoGlobal.moduls.forEach((modul, im) => {
            (modul.preguntes || []).forEach((preg, ip) => {
                total++;
                const pid = `m${im}-p${ip}`;
                const userVal = respuestasUsuario[pid];
                
                const card = document.querySelector(`div[data-id="${pid}"]`);
                if(!card) return;

                const gridItem = document.getElementById(`grid-q-${pid}`);
                const feedback = document.getElementById(`feedback-${pid}`);
                const optionsDivs = card.querySelectorAll('.option-item');

                let correctIdx = -1;
                if(preg.opcions) preg.opcions.forEach((o, i) => { if(o.esCorrecta) correctIdx = i; });

                // --- LÓGICA ANTI-TRAMPAS ---
                if (userVal !== undefined) {
                    // EL USUARIO RESPONDIÓ
                    contestadas++;
                    
                    // 1. Marcar la respuesta CORRECTA visualmente (siempre se muestra la correcta si se responde)
                    if (correctIdx !== -1 && optionsDivs[correctIdx]) {
                        optionsDivs[correctIdx].classList.add('correct');
                    }

                    if (parseInt(userVal) === correctIdx) {
                        // ACIERTO
                        aciertos++;
                        if(gridItem) {
                            gridItem.classList.remove('answered');
                            gridItem.classList.add('correct');
                        }
                    } else {
                        // FALLO
                        // Marcar la que seleccionó el usuario como error
                        if (optionsDivs[userVal]) optionsDivs[userVal].classList.add('wrong');
                        if(gridItem) {
                            gridItem.classList.remove('answered');
                            gridItem.classList.add('wrong');
                        }
                    }

                    // Mostrar explicación SOLO si se ha respondido
                    if(feedback) feedback.style.display = 'block';

                } else {
                    // NO RESPONDIDA
                    if(gridItem) gridItem.classList.add('unanswered');
                    // No mostramos ni correcta ni explicación (Anti-trampas estricto)
                }

                // Bloquear inputs
                card.querySelectorAll('input').forEach(i => i.disabled = true);
            });
        });

        // CALCULAR NOTA
        const nota = total > 0 ? (aciertos / total) * 10 : 0;
        
        // MOSTRAR RESULTADO (Reutilizamos el div scoreDiv creado al inicio o el container del HTML)
        const resultContainer = document.getElementById('result-score'); // Contenedor en el footer de la card
        const scoreCardTop = document.getElementById('final-score-card'); // Contenedor arriba del todo

        // Texto del resultado
        const htmlResultado = `
            <h3>Resultats de l'intent</h3>
            <div class="score-number" style="font-size: 2rem; font-weight: bold; color: ${nota >= 5 ? 'var(--correct-text)' : 'var(--wrong-text)'}">
                ${nota.toFixed(2)}
            </div>
            <p class="score-message">${nota >= 5 ? "Enhorabona, has aprovat!" : "Has de repassar una mica més."}</p>
            <p>Encerts: <strong>${aciertos}</strong> de <strong>${total}</strong> (Contestades: ${contestadas})</p>
        `;

        // Opción A: Mostrar arriba (más visible al hacer scroll)
        if(scoreCardTop) {
            scoreCardTop.innerHTML = htmlResultado;
            scoreCardTop.style.display = 'block';
            scoreCardTop.style.padding = '20px';
            scoreCardTop.style.backgroundColor = nota >= 5 ? 'var(--correct-bg)' : 'var(--wrong-bg)';
            scoreCardTop.style.border = `1px solid ${nota >= 5 ? 'var(--correct-border)' : 'var(--wrong-border)'}`;
            scoreCardTop.style.borderRadius = '8px';
            scoreCardTop.style.marginBottom = '20px';
        }

        // Opción B: Mostrar abajo (cerca del botón)
        if(resultContainer) {
            resultContainer.innerHTML = htmlResultado;
            resultContainer.style.display = 'block';
        }

        // --- SCROLL HACIA ARRIBA ---
        const mainContent = document.querySelector('.main-content');
        if(mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Desactivar botón
        const btn = document.getElementById('submit-exam') || document.getElementById('btn-entregar-dinamico');
        if(btn) {
            btn.disabled = true;
            btn.innerText = "Revisió Finalitzada";
            btn.style.backgroundColor = "#999";
            btn.style.cursor = "not-allowed";
        }
    }
});