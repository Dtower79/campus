document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    const contenedorCentral = document.getElementById('moduls-container'); 
    const contenedorIndice = document.getElementById('course-index'); 
    const contenedorGrid = document.getElementById('quiz-grid');      
    const tituloCursEl = document.getElementById('curs-titol');     
    const descripcioCursEl = document.getElementById('curs-descripcio'); 
    
    // 1. OCULTAR EL BOTÓN LATERAL MOLESTO
    const btnLateral = document.getElementById('finish-review'); 
    if (btnLateral) {
        btnLateral.style.display = 'none'; // Lo borramos visualmente
    }

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
        // Cabecera
        if(tituloCursEl) tituloCursEl.textContent = data.titol;
        if(descripcioCursEl) {
            if (Array.isArray(data.descripcio)) {
                descripcioCursEl.innerText = data.descripcio.map(b => b.children.map(c => c.text).join('')).join('\n');
            } else {
                descripcioCursEl.innerText = data.descripcio || "";
            }
        }

        // Limpiar
        contenedorCentral.innerHTML = '';
        if(contenedorIndice) contenedorIndice.innerHTML = '';
        if(contenedorGrid) contenedorGrid.innerHTML = '';

        totalPreguntasGlobal = 0;

        // Renderizar Módulos
        if (data.moduls && data.moduls.length > 0) {
            data.moduls.forEach((modul, idx) => {
                // Índice
                if(contenedorIndice) {
                    const item = document.createElement('div');
                    item.style.padding = "10px";
                    item.style.borderBottom = "1px solid #eee";
                    item.innerHTML = `<a href="#modul-${idx}" style="text-decoration:none; color:var(--text-main);">📂 ${modul.titol}</a>`;
                    contenedorIndice.appendChild(item);
                }
                renderizarModuloCentral(modul, idx);
            });

            // BOTÓN FINAL ABAJO
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
        tituloMod.style.paddingBottom = "10px";
        tituloMod.style.color = "var(--primary-color)";
        tituloMod.textContent = modul.titol;
        contenedorCentral.appendChild(tituloMod);

        const preguntas = modul.preguntes || [];

        preguntas.forEach((preg, indexPreg) => {
            totalPreguntasGlobal++; 
            const pid = `m${indexModul}-p${indexPreg}`;
            
            // --- GRID DERECHA (Solo Números) ---
            if(contenedorGrid) {
                const numBox = document.createElement('div');
                numBox.id = `grid-num-${pid}`;
                numBox.textContent = totalPreguntasGlobal;
                numBox.className = 'grid-num-box'; // Usa el estilo CSS
                
                // Navegación al hacer clic
                numBox.onclick = () => {
                    const target = document.querySelector(`[data-id="${pid}"]`);
                    if(target) target.scrollIntoView({behavior: "smooth", block: "center"});
                };
                contenedorGrid.appendChild(numBox);
            }

            // --- TARJETA PREGUNTA ---
            const card = document.createElement('div');
            card.className = 'question-card';
            card.dataset.id = pid;

            const textoEnunciado = preg.text || preg.titol || "Sense enunciat";
            
            // Preparar texto explicación
            let textoExpli = "Sense explicació.";
            if(preg.explicacio) {
                if(Array.isArray(preg.explicacio)) {
                    textoExpli = preg.explicacio.map(b => b.children.map(c => c.text).join('')).join('<br>');
                } else {
                    textoExpli = preg.explicacio;
                }
            }

            const letras = ['a', 'b', 'c', 'd'];
            
            // Crear Opciones
            const divOpciones = document.createElement('div');
            divOpciones.className = 'options-list';

            if(preg.opcions) {
                preg.opcions.forEach((op, i) => {
                    const divOp = document.createElement('div');
                    divOp.className = 'option-item';
                    const inputId = `opt-${pid}-${i}`;

                    divOp.innerHTML = `
                        <input type="radio" name="resp-${pid}" id="${inputId}" value="${i}" class="option-radio">
                        <label for="${inputId}" style="cursor:pointer; width:100%; margin-left:8px;">
                            <strong>${letras[i]}.</strong> ${op.text}
                        </label>
                    `;
                    
                    // --- EVENTO CHANGE (CORRECCIÓN BUG 0 RESPUESTAS) ---
                    const input = divOp.querySelector('input');
                    input.addEventListener('change', () => {
                        // 1. Guardar respuesta
                        respuestasUsuario[pid] = i;
                        
                        // 2. Estilo Visual "Seleccionado" (Azul)
                        // Quitamos el azul a los hermanos
                        divOpciones.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
                        // Ponemos azul al actual
                        divOp.classList.add('selected');

                        // 3. Marcar Grid Derecha (Gris oscuro = contestada)
                        const numBox = document.getElementById(`grid-num-${pid}`);
                        if(numBox) numBox.classList.add('answered');
                        
                        // 4. Actualizar texto estado
                        const status = card.querySelector('.q-status-text');
                        if(status) status.innerText = "Resposta guardada";
                    });

                    divOpciones.appendChild(divOp);
                });
            }

            card.innerHTML = `
                <div class="q-number-box">
                    <span class="q-state">PREGUNTA ${totalPreguntasGlobal}</span>
                    <span class="q-status-text" style="font-size:0.8rem; color:gray;">Sense respondre</span>
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
            
            card.querySelector('.options-area').appendChild(divOpciones);
            contenedorCentral.appendChild(card);
        });
    }

    function corregirExamen() {
        if (!datosCursoGlobal) return;
        if (!confirm("Segur que vols entregar l'examen? Les preguntes no contestades no mostraran la solució.")) return;

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

                const numBox = document.getElementById(`grid-num-${pid}`);
                const feedback = document.getElementById(`feedback-${pid}`);
                const inputs = card.querySelectorAll('input');
                const optionDivs = card.querySelectorAll('.option-item');

                // Buscar correcta
                let correctIdx = -1;
                if(preg.opcions) preg.opcions.forEach((o, i) => { if(o.esCorrecta) correctIdx = i; });

                // --- LÓGICA DE CORRECCIÓN ---

                if (userVal !== undefined) {
                    // === HA CONTESTADO ===
                    contestadas++;
                    const valInt = parseInt(userVal);

                    // 1. Mostrar cuál es la correcta (SIEMPRE)
                    if (correctIdx !== -1 && optionDivs[correctIdx]) {
                        optionDivs[correctIdx].classList.add('correct'); // Verde
                        const label = optionDivs[correctIdx].querySelector('label');
                        if(label) label.innerHTML += ' ✅';
                    }

                    // 2. Evaluar al usuario
                    if (valInt === correctIdx) {
                        aciertos++;
                        if(numBox) numBox.classList.add('grid-correct'); // Grid Verde
                    } else {
                        // Fallo: Marcar la suya en rojo
                        if (optionDivs[valInt]) {
                            optionDivs[valInt].classList.add('wrong');
                        }
                        if(numBox) numBox.classList.add('grid-wrong'); // Grid Rojo
                    }

                    // 3. Mostrar Explicación
                    if(feedback) feedback.style.display = 'block';

                } else {
                    // === NO HA CONTESTADO ===
                    // Grid naranja (aviso)
                    if(numBox) numBox.classList.add('grid-unanswered');
                    
                    // NO marcamos la correcta en verde.
                    // NO mostramos la explicación.
                    // NO sumamos acierto.
                }

                // Bloquear inputs
                inputs.forEach(i => i.disabled = true);
            });
        });

        // CALCULAR NOTA
        const nota = total > 0 ? (aciertos / total) * 10 : 0;
        
        // MOSTRAR RESULTADO
        const scoreDiv = document.getElementById('final-score-card');
        scoreDiv.innerHTML = `
            <h3>Resultats</h3>
            <span class="score-number">${nota.toFixed(2)}</span>
            <p>Has encertat <strong>${aciertos}</strong> de <strong>${total}</strong> (Contestades: ${contestadas})</p>
        `;
        scoreDiv.style.display = 'block';
        scoreDiv.scrollIntoView({ behavior: 'smooth' });

        // Desactivar botón
        const btn = document.getElementById('btn-entregar-final');
        btn.innerText = "Revisió Finalitzada";
        btn.disabled = true;
        btn.style.backgroundColor = "#6c757d";
    }
});