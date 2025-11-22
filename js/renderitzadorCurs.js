document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    const contenedorCentral = document.getElementById('moduls-container'); 
    const contenedorIndice = document.getElementById('course-index'); 
    const contenedorGrid = document.getElementById('quiz-grid');      
    const tituloCursEl = document.getElementById('curs-titol');     
    const descripcioCursEl = document.getElementById('curs-descripcio'); 
    
    // Ya no usamos el botón lateral (finish-review) como pediste

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

        // CAJA DE NOTA (La creamos oculta al principio)
        const scoreDiv = document.createElement('div');
        scoreDiv.id = 'final-score-card';
        scoreDiv.className = 'score-card';
        contenedorCentral.appendChild(scoreDiv);

        if (data.moduls && data.moduls.length > 0) {
            data.moduls.forEach((modul, idx) => {
                if(contenedorIndice) {
                    const item = document.createElement('a');
                    item.className = 'module-link';
                    item.href = `#modul-${idx}`;
                    item.innerHTML = `<i class="fas fa-folder"></i> ${modul.titol}`;
                    contenedorIndice.appendChild(item);
                }
                renderizarModuloCentral(modul, idx);
            });

            // BOTÓN FINAL (Solo abajo)
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
        tituloMod.style.borderBottom = "2px solid var(--primary-color)";
        tituloMod.style.paddingBottom = "10px";
        tituloMod.style.marginTop = "30px";
        tituloMod.textContent = modul.titol;
        contenedorCentral.appendChild(tituloMod);

        const preguntas = modul.preguntes || [];

        preguntas.forEach((preg, indexPreg) => {
            totalPreguntasGlobal++; 
            const pid = `m${indexModul}-p${indexPreg}`;
            
            // --- GRID DERECHO ---
            if(contenedorGrid) {
                const gridItem = document.createElement('div');
                gridItem.className = 'grid-item';
                gridItem.id = `grid-q-${totalPreguntasGlobal}`; // Usamos el contador global
                gridItem.textContent = totalPreguntasGlobal;
                gridItem.onclick = () => {
                    const card = document.querySelector(`[data-id="${pid}"]`);
                    if(card) card.scrollIntoView({behavior: "smooth", block: "center"});
                };
                contenedorGrid.appendChild(gridItem);
            }

            // --- TARJETA CENTRAL ---
            const card = document.createElement('div');
            card.className = 'question-card';
            card.id = `question-${totalPreguntasGlobal}`;
            card.dataset.id = pid;
            card.dataset.globalId = totalPreguntasGlobal;

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
            
            // Construir HTML Opciones
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-list';
            optionsContainer.id = `options-list-${pid}`;

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
                    
                    // Lógica de selección
                    optRow.addEventListener('click', (e) => {
                        if (isExamFinished) return;
                        // Si clicamos en el div, marcamos el radio
                        const radio = optRow.querySelector('input');
                        radio.checked = true;
                        
                        respuestasUsuario[pid] = i;
                        
                        // Estilos visuales (limpiar hermanos)
                        optionsContainer.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
                        optRow.classList.add('selected');

                        // Marcar grid como contestado
                        const gridEl = document.getElementById(`grid-q-${card.dataset.globalId}`);
                        if(gridEl) gridEl.classList.add('answered');
                        
                        // Actualizar texto estado
                        const stateEl = card.querySelector('.q-state span');
                        if(stateEl) stateEl.innerText = "Respost";
                    });

                    optionsContainer.appendChild(optRow);
                });
            }

            // Estructura completa de la tarjeta
            card.innerHTML = `
                <div class="q-number-box">
                    <span class="q-state">Pregunta ${totalPreguntasGlobal}</span>
                    <span class="q-state" style="font-weight:normal; font-size:0.8rem; color:#666;"><span>Sense respondre</span></span>
                    <div class="q-points">Puntua 1,00</div>
                </div>
                <div class="q-content-box">
                    <div class="q-text-area">${textoEnunciado}</div>
                    <div class="options-area"></div> <!-- Aquí meteremos las opciones -->
                    <div id="feedback-${pid}" class="explanation-box">
                        <strong>Explicació:</strong><br>
                        <span>${textoExpli}</span>
                    </div>
                </div>
            `;
            
            // Inyectar opciones donde toca
            card.querySelector('.options-area').appendChild(optionsContainer);
            contenedorCentral.appendChild(card);
        });
    }

    function corregirExamen() {
        if (!datosCursoGlobal) return;
        if (!confirm("Segur que vols entregar l'examen?")) return;

        isExamFinished = true; // Bloqueo
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
                
                const globalId = card.dataset.globalId;
                const gridItem = document.getElementById(`grid-q-${globalId}`);
                const feedback = document.getElementById(`feedback-${pid}`);
                const optionsList = document.getElementById(`options-list-${pid}`);
                const optionItems = optionsList.querySelectorAll('.option-item');

                let correctIdx = -1;
                preg.opcions.forEach((o, i) => { if(o.esCorrecta) correctIdx = i; });

                // --- LÓGICA ANTI-TRAMPAS ---
                
                if (userVal !== undefined) {
                    // CASO: RESPONDIDA
                    contestadas++;
                    
                    // Marcar la correcta en verde
                    if (correctIdx !== -1 && optionItems[correctIdx]) {
                        optionItems[correctIdx].classList.add('correct');
                    }

                    if (parseInt(userVal) === correctIdx) {
                        aciertos++;
                        if(gridItem) gridItem.className = 'grid-item correct';
                    } else {
                        // Marcar la del usuario en rojo
                        if(optionItems[userVal]) optionItems[userVal].classList.add('wrong');
                        if(gridItem) gridItem.className = 'grid-item wrong';
                    }

                    // Mostrar Explicación
                    if(feedback) feedback.style.display = 'block';

                } else {
                    // CASO: NO RESPONDIDA (NO CHIVAR NADA)
                    // No marcamos la correcta.
                    // No mostramos explicación.
                    // No cambiamos el grid a rojo (se queda gris o neutro).
                    if(gridItem) gridItem.style.opacity = "0.5"; // Efecto visual de "saltada"
                }

                // Bloquear inputs
                card.querySelectorAll('input').forEach(i => i.disabled = true);
            });
        });

        // CALCULAR NOTA
        const nota = total > 0 ? (aciertos / total) * 10 : 0;
        
        // PINTAR RESULTADO ARRIBA
        const scoreCard = document.getElementById('final-score-card');
        let missatge = nota >= 5 ? "Enhorabona! Has superat el test." : "Has de repassar.";
        
        scoreCard.innerHTML = `
            <h3 style="margin-top:0;">Resultats</h3>
            <span class="score-number">${nota.toFixed(2)}</span>
            <p class="score-message">${missatge}</p>
            <p>Encerts: <strong>${aciertos}</strong> / ${total} (Contestades: ${contestadas})</p>
        `;
        scoreCard.style.display = 'block';
        scoreCard.scrollIntoView({ behavior: 'smooth' });

        // Desactivar botón
        const btn = document.getElementById('btn-entregar-final');
        btn.innerText = "Revisió Finalitzada";
        btn.disabled = true;
        btn.style.backgroundColor = "#6c757d";
    }
});