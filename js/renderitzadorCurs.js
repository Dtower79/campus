document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    // ELEMENTOS DEL HTML
    const contenedorCentral = document.getElementById('moduls-container'); 
    const contenedorIndice = document.getElementById('course-index'); // Izquierda
    const contenedorGrid = document.getElementById('quiz-grid');      // Derecha (Números)
    const tituloCursEl = document.getElementById('curs-titol');     
    const descripcioCursEl = document.getElementById('curs-descripcio'); 
    const btnLateral = document.getElementById('finish-review'); 

    if (!slug) return;

    // ESTADO
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
        // 1. Cabecera y Descripción
        if(tituloCursEl) tituloCursEl.textContent = data.titol;
        if(descripcioCursEl) {
            if (Array.isArray(data.descripcio)) {
                descripcioCursEl.innerText = data.descripcio.map(b => b.children.map(c => c.text).join('')).join('\n');
            } else {
                descripcioCursEl.innerText = data.descripcio || "";
            }
        }

        // 2. Limpiar
        contenedorCentral.innerHTML = '';
        if(contenedorIndice) contenedorIndice.innerHTML = '';
        if(contenedorGrid) contenedorGrid.innerHTML = '';

        totalPreguntasGlobal = 0;

        // 3. Renderizar
        if (data.moduls && data.moduls.length > 0) {
            data.moduls.forEach((modul, idx) => {
                // A. Índice Izquierdo
                if(contenedorIndice) {
                    const item = document.createElement('div');
                    item.className = 'module-item'; // Asegúrate de tener CSS para esto o usa style
                    item.style.padding = "10px";
                    item.style.borderBottom = "1px solid #eee";
                    item.innerHTML = `<a href="#modul-${idx}" style="text-decoration:none; color:#333;">📂 ${modul.titol}</a>`;
                    contenedorIndice.appendChild(item);
                }

                renderizarModuloCentral(modul, idx);
            });

            // 4. Botón Final Abajo
            const divBoton = document.createElement('div');
            divBoton.className = 'text-center mt-5 mb-5';
            divBoton.innerHTML = `
                <button id="btn-entregar-final" class="btn btn-primary btn-lg px-5" style="background-color: #0d6efd; color: white; padding: 10px 20px; border: none; border-radius: 5px; font-size: 1.1em; cursor: pointer;">
                    Entregar i Corregir
                </button>
            `;
            contenedorCentral.appendChild(divBoton);
            document.getElementById('btn-entregar-final').addEventListener('click', corregirExamen);
        }

        if(btnLateral) btnLateral.addEventListener('click', (e) => {
            e.preventDefault();
            corregirExamen();
        });
    }

    function renderizarModuloCentral(modul, indexModul) {
        const tituloMod = document.createElement('h3');
        tituloMod.id = `modul-${indexModul}`;
        tituloMod.className = 'mt-4 mb-3';
        tituloMod.style.borderBottom = "2px solid #0d6efd";
        tituloMod.style.paddingBottom = "10px";
        tituloMod.textContent = modul.titol;
        contenedorCentral.appendChild(tituloMod);

        const preguntas = modul.preguntes || [];

        preguntas.forEach((preg, indexPreg) => {
            totalPreguntasGlobal++; // Contador global para los números de la derecha
            const pid = `m${indexModul}-p${indexPreg}`;
            
            // --- B. GRID DERECHO (NÚMEROS) ---
            if(contenedorGrid) {
                const numBox = document.createElement('div');
                numBox.id = `grid-num-${pid}`;
                numBox.textContent = totalPreguntasGlobal;
                // Estilos básicos por si faltan en CSS
                numBox.style.display = "inline-block";
                numBox.style.width = "30px";
                numBox.style.height = "30px";
                numBox.style.lineHeight = "30px";
                numBox.style.textAlign = "center";
                numBox.style.margin = "5px";
                numBox.style.border = "1px solid #ccc";
                numBox.style.borderRadius = "3px";
                numBox.style.cursor = "pointer";
                numBox.style.fontSize = "0.9em";
                
                numBox.onclick = () => {
                    document.querySelector(`[data-id="${pid}"]`).scrollIntoView({behavior: "smooth"});
                };
                contenedorGrid.appendChild(numBox);
            }

            // --- C. TARJETA CENTRAL ---
            const card = document.createElement('div');
            card.className = 'card mb-4';
            card.style.border = "1px solid #ddd";
            card.style.borderRadius = "5px";
            card.style.marginBottom = "20px";
            card.style.padding = "20px";
            card.style.backgroundColor = "white";
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
            let htmlOpciones = '';
            
            if(preg.opcions) {
                preg.opcions.forEach((op, i) => {
                    const letra = letras[i] || '-';
                    htmlOpciones += `
                        <div style="margin-bottom: 8px;">
                            <input type="radio" name="resp-${pid}" id="opt-${pid}-${i}" value="${i}" style="margin-right: 8px;">
                            <label for="opt-${pid}-${i}" style="cursor:pointer;">
                                <strong>${letra}.</strong> ${op.text}
                            </label>
                        </div>
                    `;
                });
            }

            card.innerHTML = `
                <div style="color: #666; font-size: 0.9em; margin-bottom: 10px; text-transform: uppercase;">Pregunta ${indexPreg + 1}</div>
                <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 15px;">${textoEnunciado}</div>
                <div style="margin-left: 10px;">${htmlOpciones}</div>
                
                <div id="feedback-${pid}" style="display:none; margin-top: 15px; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 5px;">
                    <strong style="color: #856404;">Explicació:</strong><br>
                    <span style="color: #856404;">${textoExpli}</span>
                </div>
            `;

            contenedorCentral.appendChild(card);

            // Evento: Al responder, pintar el numerito de la derecha
            const inputs = card.querySelectorAll('input');
            inputs.forEach(inp => {
                inp.addEventListener('change', () => {
                    respuestasUsuario[pid] = inp.value;
                    const numBox = document.getElementById(`grid-num-${pid}`);
                    if(numBox) {
                        numBox.style.backgroundColor = "#333";
                        numBox.style.color = "white";
                    }
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
                const numBox = document.getElementById(`grid-num-${pid}`);
                
                // Lógica correcta
                let correctIdx = -1;
                preg.opcions.forEach((o, i) => { if(o.esCorrecta) correctIdx = i; });

                const card = document.querySelector(`div[data-id="${pid}"]`);
                if(!card) return;

                // Mostrar Feedback
                const feedback = document.getElementById(`feedback-${pid}`);
                if(feedback) feedback.style.display = 'block';

                const labels = card.querySelectorAll('label');
                const inputs = card.querySelectorAll('input');

                // Marcar texto verde
                if(correctIdx !== -1 && labels[correctIdx]) {
                    labels[correctIdx].style.color = "green";
                    labels[correctIdx].style.fontWeight = "bold";
                }

                if(userVal !== undefined) {
                    if(parseInt(userVal) === correctIdx) {
                        aciertos++;
                        card.style.backgroundColor = "#d4edda"; // Verde suave
                        card.style.borderColor = "#c3e6cb";
                        if(numBox) numBox.style.backgroundColor = "green"; // Grid verde
                    } else {
                        card.style.backgroundColor = "#f8d7da"; // Rojo suave
                        card.style.borderColor = "#f5c6cb";
                        if(labels[userVal]) labels[userVal].style.textDecoration = "line-through";
                        if(numBox) numBox.style.backgroundColor = "red"; // Grid rojo
                    }
                } else {
                    // No respondida
                    card.style.border = "1px solid orange";
                    if(numBox) numBox.style.backgroundColor = "orange";
                }

                inputs.forEach(i => i.disabled = true);
            });
        });

        alert(`Nota Final: ${((aciertos/total)*10).toFixed(2)}`);
        window.scrollTo(0,0);
    }
});