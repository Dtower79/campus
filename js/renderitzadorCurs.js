document.addEventListener('DOMContentLoaded', () => {
    // 1. OBTENER SLUG DE LA URL
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    // 2. SELECCIONAR ELEMENTOS DEL DOM (Estos coinciden con tu nuevo index.html)
    // IMPORTANTE: Si cambias los IDs en el HTML, debes cambiarlos aquí.
    const contenedorCentral = document.getElementById('moduls-container'); 
    const contenedorIndice = document.getElementById('course-index'); 
    const contenedorGrid = document.getElementById('quiz-grid');      
    const tituloCursEl = document.getElementById('curs-titol');     
    const descripcioCursEl = document.getElementById('curs-descripcio'); 
    
    // Elementos extra (por si existen botones antiguos)
    const linkLateral = document.getElementById('finish-review');
    if(linkLateral) linkLateral.style.display = 'none';

    // Si no hay slug, no hacemos nada (el index.html mostrará el Dashboard)
    if (!slug) return;

    // VARIABLES DE ESTADO
    let respuestasUsuario = {}; 
    let datosCursoGlobal = null;
    let totalPreguntasGlobal = 0;

    // INICIAR CARGA
    cargarDatos();

    async function cargarDatos() {
        try {
            // Llamada al Middleware
            const response = await fetch(`/.netlify/functions/dadesCurs?slug=${slug}`);
            
            if (!response.ok) throw new Error('Error al servidor o curs no trobat');
            
            const data = await response.json();
            datosCursoGlobal = data;
            
            renderizarTodo(data);
            
        } catch (error) {
            console.error(error);
            if(contenedorCentral) {
                contenedorCentral.innerHTML = `
                    <div class="alert alert-danger">
                        <h3>Error carregant el curs</h3>
                        <p>${error.message}</p>
                        <a href="/" class="btn-small">Tornar a l'inici</a>
                    </div>`;
            }
            if(tituloCursEl) tituloCursEl.innerText = "Error";
        }
    }

    function renderizarTodo(data) {
        // 1. Poner Título y Descripción
        if(tituloCursEl) tituloCursEl.textContent = data.titol;
        
        if(descripcioCursEl) {
            if (Array.isArray(data.descripcio)) {
                // Si viene de Strapi rich text
                descripcioCursEl.innerText = data.descripcio.map(b => b.children.map(c => c.text).join('')).join('\n');
            } else {
                descripcioCursEl.innerText = data.descripcio || "";
            }
        }

        // 2. Limpiar contenedores antes de pintar
        if(contenedorCentral) contenedorCentral.innerHTML = '';
        if(contenedorIndice) contenedorIndice.innerHTML = '';
        if(contenedorGrid) contenedorGrid.innerHTML = '';

        totalPreguntasGlobal = 0;

        // 3. Crear tarjeta de NOTA (oculta al principio)
        const scoreDiv = document.createElement('div');
        scoreDiv.id = 'final-score-card';
        scoreDiv.className = 'score-card alert'; // Clase alert para darle estilo base
        scoreDiv.style.display = 'none';
        scoreDiv.style.marginBottom = '20px';
        
        // AQUÍ ERA DONDE FALLABA: Si contenedorCentral era null, esto explotaba.
        if(contenedorCentral) contenedorCentral.appendChild(scoreDiv);

        if (data.moduls && data.moduls.length > 0) {
            data.moduls.forEach((modul, idx) => {
                // A. Índice Lateral
                if(contenedorIndice) {
                    const item = document.createElement('a');
                    item.className = 'module-link';
                    item.href = `#modul-${idx}`;
                    // Usamos icono simple por si FontAwesome falla
                    item.innerHTML = `<span>📂</span> ${modul.titol}`;
                    contenedorIndice.appendChild(item);
                }
                // B. Contenido Central
                renderizarModuloCentral(modul, idx);
            });

            // 4. Botón de Entregar (Al final del todo)
            if(contenedorCentral) {
                const divBoton = document.createElement('div');
                divBoton.className = 'text-center mt-5 mb-5';
                divBoton.innerHTML = `
                    <button id="btn-entregar-final" class="btn-primary">
                        Entregar i Corregir
                    </button>
                `;
                contenedorCentral.appendChild(divBoton);
                
                // Event Listener
                document.getElementById('btn-entregar-final').addEventListener('click', corregirExamen);
            }
        } else {
            if(contenedorCentral) contenedorCentral.innerHTML = '<p>Aquest curs no té contingut.</p>';
        }
    }

    function renderizarModuloCentral(modul, indexModul) {
        // Si el contenedor principal no existe, paramos para evitar errores
        if(!contenedorCentral) return;

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
            card.className = 'question-card'; // Clase CSS definida en estil.css
            card.dataset.id = pid;

            // Procesar texto
            const textoEnunciado = preg.text || preg.titol || "Sense enunciat";
            let textoExpli = "Sense explicació.";
            if(preg.explicacio) {
                if(Array.isArray(preg.explicacio)) {
                    textoExpli = preg.explicacio.map(b => b.children.map(c => c.text).join('')).join('<br>');
                } else {
                    textoExpli = preg.explicacio;
                }
            }

            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-list';

            if(preg.opcions) {
                preg.opcions.forEach((op, i) => {
                    const optRow = document.createElement('div');
                    optRow.className = 'option-item'; // Clase CSS
                    const inputId = `opt-${pid}-${i}`;
                    const letras = ['A', 'B', 'C', 'D'];
                    
                    optRow.innerHTML = `
                        <input type="radio" name="resp-${pid}" id="${inputId}" value="${i}" class="option-radio">
                        <label for="${inputId}" style="cursor:pointer; width:100%; margin-left: 10px;">
                            <strong>${letras[i] || i}.</strong> ${op.text}
                        </label>
                    `;
                    
                    // Evento de Selección
                    const radio = optRow.querySelector('input');
                    radio.addEventListener('change', () => {
                        respuestasUsuario[pid] = i;
                        
                        // Visuals: .selected
                        optionsContainer.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
                        optRow.classList.add('selected');

                        // Grid Derecha
                        const gridEl = document.getElementById(`grid-q-${pid}`);
                        if(gridEl) gridEl.classList.add('answered');
                    });

                    optionsContainer.appendChild(optRow);
                });
            }

            // Estructura HTML de la pregunta
            card.innerHTML = `
                <div class="q-header">
                    <span>Pregunta ${totalPreguntasGlobal}</span>
                </div>
                <div class="q-text">${textoEnunciado}</div>
                <div class="options-area"></div>
                <div id="feedback-${pid}" class="explanation-box">
                    <strong>Explicació:</strong><br>
                    <span>${textoExpli}</span>
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

                // --- LÓGICA CORRECCIÓN ---
                if (userVal !== undefined) {
                    contestadas++;
                    
                    // 1. Marcar la respuesta CORRECTA visualmente
                    if (correctIdx !== -1 && optionsDivs[correctIdx]) {
                        optionsDivs[correctIdx].classList.add('correct');
                    }

                    if (parseInt(userVal) === correctIdx) {
                        // Acierto
                        aciertos++;
                        if(gridItem) {
                            gridItem.classList.remove('answered');
                            gridItem.classList.add('correct');
                        }
                    } else {
                        // Fallo (Marcamos en rojo la elegida)
                        if (optionsDivs[userVal]) optionsDivs[userVal].classList.add('wrong');
                        if(gridItem) {
                            gridItem.classList.remove('answered');
                            gridItem.classList.add('wrong');
                        }
                    }
                    // Mostrar explicación
                    if(feedback) feedback.style.display = 'block';

                } else {
                    // No respondida
                    if(gridItem) gridItem.classList.add('unanswered');
                }

                // Bloquear inputs
                card.querySelectorAll('input').forEach(i => i.disabled = true);
            });
        });

        // CALCULAR NOTA
        const nota = total > 0 ? (aciertos / total) * 10 : 0;
        
        // MOSTRAR RESULTADO (Estilo Centrado "Antiguo")
        const scoreCard = document.getElementById('final-score-card');
        if(scoreCard) {
            // Determinamos color del mensaje (no del fondo)
            const colorMensaje = nota >= 5 ? '#155724' : '#721c24'; 
            
            scoreCard.innerHTML = `
                <h3 style="color:var(--text-secondary); text-transform:uppercase; font-size:0.9rem; letter-spacing:1px;">Resultats</h3>
                
                <div class="score-big-number">${nota.toFixed(2)}</div>
                
                <p class="score-text" style="color:${colorMensaje}; font-weight:bold;">
                    ${nota >= 5 ? "Aprovat" : "Has de repassar."}
                </p>
                
                <p style="color:#666; margin-top:5px;">
                    Encerts: <strong>${aciertos}</strong> / ${total} (Contestades: ${contestadas})
                </p>
            `;
            
            scoreCard.style.display = 'block';
            // Quitamos estilos inline que forzaban colores de alerta
            scoreCard.className = ''; 
            scoreCard.style.backgroundColor = '#ffffff';
            scoreCard.style.borderColor = '#dfe1e5';
        }

        // Scroll arriba
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Desactivar botón
        const btn = document.getElementById('btn-entregar-final');
        if(btn) {
            btn.disabled = true;
            btn.innerText = "Revisió Finalitzada";
            btn.style.backgroundColor = "#999";
        }
    }
});