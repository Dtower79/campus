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
                    item.className = 'module-item';
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
            totalPreguntasGlobal++; 
            const pid = `m${indexModul}-p${indexPreg}`;
            
            // --- B. GRID DERECHO (NÚMEROS) ---
            if(contenedorGrid) {
                const numBox = document.createElement('div');
                numBox.id = `grid-num-${pid}`;
                numBox.textContent = totalPreguntasGlobal; // SIEMPRE EL NÚMERO
                numBox.style.display = "inline-block";
                numBox.style.width = "35px";
                numBox.style.height = "35px";
                numBox.style.lineHeight = "35px";
                numBox.style.textAlign = "center";
                numBox.style.margin = "4px";
                numBox.style.border = "1px solid #ccc";
                numBox.style.borderRadius = "4px";
                numBox.style.cursor = "pointer";
                numBox.style.fontSize = "0.9em";
                numBox.style.backgroundColor = "#f8f9fa";
                
                // Navegación al hacer clic
                numBox.onclick = () => {
                    const target = document.querySelector(`[data-id="${pid}"]`);
                    if(target) {
                        target.scrollIntoView({behavior: "smooth", block: "center"});
                        // Pequeño efecto de parpadeo para localizarla
                        target.style.transition = "background 0.5s";
                        const originalBg = target.style.backgroundColor;
                        target.style.backgroundColor = "#ffffd0";
                        setTimeout(() => target.style.backgroundColor = originalBg || "white", 1000);
                    }
                };
                contenedorGrid.appendChild(numBox);
            }

            // --- C. TARJETA CENTRAL ---
            const card = document.createElement('div');
            card.className = 'card mb-4';
            // Estilos inline para asegurar diseño clásico
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
                        <div style="margin-bottom: 8px;" class="option-row">
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

            // Evento cambio respuesta
            const inputs = card.querySelectorAll('input');
            inputs.forEach(inp => {
                inp.addEventListener('change', () => {
                    respuestasUsuario[pid] = inp.value;
                    const numBox = document.getElementById(`grid-num-${pid}`);
                    if(numBox) {
                        numBox.style.backgroundColor = "#333"; // Marcada (negro/gris)
                        numBox.style.color = "white";
                        numBox.style.borderColor = "#333";
                    }
                });
            });
        });
    }

    function corregirExamen() {
        if (!datosCursoGlobal) return;
        if (!confirm("Segur que vols finalitzar? Les preguntes no contestades no es corregiran.")) return;

        let aciertos = 0;
        let total = 0;
        let contestadas = 0;

        datosCursoGlobal.moduls.forEach((modul, im) => {
            (modul.preguntes || []).forEach((preg, ip) => {
                total++;
                const pid = `m${im}-p${ip}`;
                const userVal = respuestasUsuario[pid]; // undefined si no contestó
                const numBox = document.getElementById(`grid-num-${pid}`);
                
                // Buscar correcta (dato interno)
                let correctIdx = -1;
                preg.opcions.forEach((o, i) => { if(o.esCorrecta) correctIdx = i; });

                const card = document.querySelector(`div[data-id="${pid}"]`);
                if(!card) return;

                const feedback = document.getElementById(`feedback-${pid}`);
                const labels = card.querySelectorAll('label');
                const inputs = card.querySelectorAll('input');

                // --- LÓGICA ANTI-TRAMPAS ---
                
                if(userVal !== undefined) {
                    // CASO A: EL ALUMNO RESPONDIÓ
                    contestadas++;
                    
                    // 1. Mostrar si la suya es correcta o no
                    if(parseInt(userVal) === correctIdx) {
                        // Acierto
                        aciertos++;
                        card.style.backgroundColor = "#d4edda"; // Fondo Verde
                        card.style.borderColor = "#c3e6cb";
                        if(numBox) {
                            numBox.style.backgroundColor = "#28a745"; // Grid Verde
                            numBox.style.color = "white";
                            numBox.style.borderColor = "#28a745";
                        }
                    } else {
                        // Fallo
                        card.style.backgroundColor = "#f8d7da"; // Fondo Rojo
                        card.style.borderColor = "#f5c6cb";
                        if(labels[userVal]) labels[userVal].style.textDecoration = "line-through";
                        if(numBox) {
                            numBox.style.backgroundColor = "#dc3545"; // Grid Rojo
                            numBox.style.color = "white";
                            numBox.style.borderColor = "#dc3545";
                        }
                    }

                    // 2. Chivar cuál era la correcta (SIEMPRE, si ha respondido)
                    if(correctIdx !== -1 && labels[correctIdx]) {
                        labels[correctIdx].style.color = "green";
                        labels[correctIdx].style.fontWeight = "bold";
                        labels[correctIdx].innerHTML += " ✅";
                    }

                    // 3. Mostrar Explicación (SOLO si ha respondido)
                    if(feedback) feedback.style.display = 'block';

                } else {
                    // CASO B: EL ALUMNO LA DEJÓ EN BLANCO
                    // No sumamos aciertos.
                    
                    // Estilo neutro/aviso
                    card.style.border = "2px dashed orange";
                    card.style.opacity = "0.7"; // Un poco más apagada
                    
                    if(numBox) {
                        numBox.style.backgroundColor = "#ffc107"; // Grid Naranja
                        numBox.style.color = "black";
                        numBox.style.borderColor = "#ffc107";
                        // Mantenemos el número visible
                    }

                    // IMPORTANTE: NO enseñamos la correcta NI la explicación
                    // (Se queda todo oculto para que no pueda copiar)
                }

                // Bloquear inputs siempre al final
                inputs.forEach(i => i.disabled = true);
            });
        });

        // Calcular nota (sobre el total de preguntas del examen, no solo las contestadas)
        // Si hay 20 preguntas y contestas 10 bien y 10 en blanco -> Nota 5.00
        const nota = total > 0 ? (aciertos / total) * 10 : 0;
        
        alert(`Has contestat ${contestadas} de ${total}.\nNota Final: ${nota.toFixed(2)}`);
        window.scrollTo(0,0);
    }
});