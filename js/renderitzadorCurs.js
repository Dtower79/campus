document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    const contenedorCentral = document.getElementById('moduls-container'); 
    const contenedorIndice = document.getElementById('course-index'); 
    const contenedorGrid = document.getElementById('quiz-grid');      
    const tituloCursEl = document.getElementById('curs-titol');     
    const descripcioCursEl = document.getElementById('curs-descripcio'); 
    
    // OCULTAR enlace lateral si existe
    const linkLateral = document.getElementById('finish-review');
    if(linkLateral) linkLateral.style.display = 'none';

    if (!slug) return;

    let respuestasUsuario = {}; 
    let datosCursoGlobal = null;
    let totalPreguntasGlobal = 0;

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
        if(tituloCursEl) tituloCursEl.textContent = data.titol;
        if(descripcioCursEl) {
            if (Array.isArray(data.descripcio)) {
                descripcioCursEl.innerText = data.descripcio.map(b => b.children.map(c => c.text).join('')).join('\n');
            } else {
                descripcioCursEl.innerText = data.descripcio || "";
            }
        }

        contenedorCentral.innerHTML = '';
        if(contenedorIndice) contenedorIndice.innerHTML = '';
        if(contenedorGrid) contenedorGrid.innerHTML = '';

        totalPreguntasGlobal = 0;

        // Crear tarjeta de NOTA (oculta) arriba del todo
        const scoreDiv = document.createElement('div');
        scoreDiv.id = 'final-score-card';
        scoreDiv.className = 'score-card';
        contenedorCentral.appendChild(scoreDiv);

        if (data.moduls && data.moduls.length > 0) {
            data.moduls.forEach((modul, idx) => {
                // Índice
                if(contenedorIndice) {
                    const item = document.createElement('a');
                    item.className = 'module-link';
                    item.href = `#modul-${idx}`;
                    item.innerHTML = `<i class="fas fa-folder"></i> ${modul.titol}`;
                    contenedorIndice.appendChild(item);
                }
                renderizarModuloCentral(modul, idx);
            });

            // Botón Abajo
            const divBoton = document.createElement('div');
            divBoton.className = 'text-center mt-5 mb-5';
            divBoton.innerHTML = `
                <button id="btn-entregar-final" class="btn-finish">
                    <i class="fas fa-check-circle"></i> Entregar i Corregir
                </button>
            `;
            contenedorCentral.appendChild(divBoton);
            document.getElementById('btn-entregar-final').addEventListener('click', corregirExamen);
        }
    }

    function renderizarModuloCentral(modul, indexModul) {
        const tituloMod = document.createElement('h3');
        tituloMod.id = `modul-${indexModul}`;
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
                gridItem.className = 'grid-item'; // Clase CSS que da forma de cuadrado
                gridItem.id = `grid-q-${pid}`;
                gridItem.textContent = totalPreguntasGlobal;
                
                gridItem.onclick = () => {
                    const card = document.querySelector(`[data-id="${pid}"]`);
                    if(card) card.scrollIntoView({behavior: "smooth", block: "center"});
                };
                contenedorGrid.appendChild(gridItem);
            }

            // --- TARJETA ---
            const card = document.createElement('div');
            card.className = 'question-card';
            card.dataset.id = pid;

            const textoEnunciado = preg.text || preg.titol || "Sense enunciat";
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
                        <label for="${inputId}" style="cursor:pointer; width:100%;">
                            <strong>${letras[i]}.</strong> ${op.text}
                        </label>
                    `;
                    
                    // Evento Change (Fiable)
                    const radio = optRow.querySelector('input');
                    radio.addEventListener('change', () => {
                        respuestasUsuario[pid] = i;
                        
                        // Visuals
                        optionsContainer.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
                        optRow.classList.add('selected');

                        // Grid Derecha (Gris = contestada)
                        const gridEl = document.getElementById(`grid-q-${pid}`);
                        if(gridEl) gridEl.classList.add('answered');
                        
                        // Texto Estado
                        const st = card.querySelector('#status-text');
                        if(st) st.innerText = "Resposta guardada";
                    });

                    optionsContainer.appendChild(optRow);
                });
            }

            card.innerHTML = `
                <div class="q-number-box">
                    <span class="q-state">Pregunta ${totalPreguntasGlobal}</span>
                    <span id="status-text" class="q-state" style="font-weight:normal; font-size:0.8rem; color:gray;">Sense respondre</span>
                    <div class="q-points">Puntua 1,00</div>
                </div>
                <div class="q-content-box">
                    <div class="q-text-area">${textoEnunciado}</div>
                    <div class="options-area"></div>
                    <div id="feedback-${pid}" class="explanation-box">
                        <strong>Explicació:</strong><br>
                        <span>${textoExpli}</span>
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

                if (userVal !== undefined) {
                    // RESPONDIDA
                    contestadas++;
                    
                    // Marcar correcta
                    if (correctIdx !== -1 && optionsDivs[correctIdx]) {
                        optionsDivs[correctIdx].classList.add('correct');
                    }

                    if (parseInt(userVal) === correctIdx) {
                        aciertos++;
                        if(gridItem) {
                            gridItem.classList.remove('answered');
                            gridItem.classList.add('correct');
                        }
                    } else {
                        // Marcar la suya incorrecta
                        if (optionsDivs[userVal]) optionsDivs[userVal].classList.add('wrong');
                        if(gridItem) {
                            gridItem.classList.remove('answered');
                            gridItem.classList.add('wrong');
                        }
                    }

                    // Mostrar explicación
                    if(feedback) feedback.style.display = 'block';

                } else {
                    // NO RESPONDIDA
                    if(gridItem) gridItem.classList.add('unanswered');
                    // No mostramos nada más
                }

                // Bloquear
                card.querySelectorAll('input').forEach(i => i.disabled = true);
            });
        });

        // Nota
        const nota = total > 0 ? (aciertos / total) * 10 : 0;
        
        // Mostrar Panel Superior
        const scoreCard = document.getElementById('final-score-card');
        scoreCard.innerHTML = `
            <h3>Resultats de l'intent</h3>
            <span class="score-number">${nota.toFixed(2)}</span>
            <p class="score-message">${nota >= 5 ? "Aprovat!" : "Has de repassar."}</p>
            <p>Encerts: <strong>${aciertos}</strong> de <strong>${total}</strong> (Contestades: ${contestadas})</p>
        `;
        scoreCard.style.display = 'block';

        // SCROLL ARRIBA
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Desactivar botón
        const btn = document.getElementById('btn-entregar-final');
        btn.disabled = true;
        btn.innerText = "Revisió Finalitzada";
        btn.style.backgroundColor = "#999";
    }
});