document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // 1. PROTECCIÓN CONTRA BUCLE INFINITO
    // ------------------------------------------------------------------------
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');

    // Si no hay 'slug', no estamos en un curso -> DETENER SCRIPT
    if (!slug) return; 

    // ------------------------------------------------------------------------
    // 2. VERIFICACIÓN DE SEGURIDAD
    // ------------------------------------------------------------------------
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');

    if (!user || !token) {
        alert("Sessió caducada. Torna a identificar-te.");
        window.location.href = 'index.html';
        return;
    }

    // ------------------------------------------------------------------------
    // 3. REFERENCIAS AL DOM
    // ------------------------------------------------------------------------
    const contenedorCentral = document.getElementById('moduls-container'); 
    const contenedorIndice = document.getElementById('course-index'); 
    const contenedorGrid = document.getElementById('quiz-grid');      
    const tituloCursEl = document.getElementById('curs-titol');
    
    // Variables de estado
    let matriculaId = null;
    let datosCurso = null;
    let respuestasUsuario = {}; 
    let examenEntregado = false;
    let totalPreguntas = 0;

    // INICIAR CARGA
    cargarCursoDesdeStrapi();

    // ------------------------------------------------------------------------
    // 4. FUNCIONES DE LÓGICA DE CARGA
    // ------------------------------------------------------------------------

    async function cargarCursoDesdeStrapi() {
        if(contenedorCentral) {
            contenedorCentral.innerHTML = '<div class="loader"></div><p class="loading-text">Carregant contingut...</p>';
        }

        try {
            // Construimos la URL para Strapi v5.
            // AHORA PEDIMOS TAMBIÉN: material_pdf y targetes_memoria
            const query = [
                `filters[users_permissions_user][id][$eq]=${user.id}`,
                `filters[curs][slug][$eq]=${slug}`,
                // Bajamos niveles: Curso -> Módulos -> Preguntas -> Opciones
                `populate[curs][populate][moduls][populate][preguntes][populate][opcions]=true`, 
                // Bajamos nivel: Curso -> Módulos -> PDF
                `populate[curs][populate][moduls][populate][material_pdf]=true`,
                // Bajamos nivel: Curso -> Módulos -> Flashcards
                `populate[curs][populate][moduls][populate][targetes_memoria]=true`,
                // Imagen principal
                `populate[curs][populate][imatge]=true`
            ].join('&');

            const url = `${STRAPI_URL}/api/matriculas?${query}`;
            
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if(!res.ok) throw new Error(`Error API: ${res.status}`);
            
            const json = await res.json();

            // Si no devuelve datos...
            if (!json.data || json.data.length === 0) {
                contenedorCentral.innerHTML = `
                    <div class="dashboard-card" style="border-top: 4px solid var(--brand-red);">
                        <h3>Accés Denegat</h3>
                        <p>No constes com a matriculat en aquest curs o l'enllaç és incorrecte.</p>
                        <button class="btn-secondary" onclick="window.location.href='index.html'">Tornar</button>
                    </div>`;
                return;
            }

            // Guardamos datos
            const matricula = json.data[0];
            matriculaId = matricula.documentId || matricula.id;
            datosCurso = matricula.curs;

            // Renderizamos
            renderizarCurso(datosCurso, matricula);

        } catch (error) {
            console.error("Error cargando curso:", error);
            if(contenedorCentral) {
                contenedorCentral.innerHTML = `<div class="alert alert-danger">Error de connexió: ${error.message}</div>`;
            }
        }
    }

    function renderizarCurso(curso, matriculaData) {
        // Título
        if(tituloCursEl) tituloCursEl.innerText = curso.titol;

        // Limpiar zonas
        if(contenedorCentral) contenedorCentral.innerHTML = '';
        if(contenedorIndice) contenedorIndice.innerHTML = '<ul style="list-style:none; padding:0;">';
        if(contenedorGrid) contenedorGrid.innerHTML = '';
        
        totalPreguntas = 0;

        // Validar si hay módulos
        if (!curso.moduls || curso.moduls.length === 0) {
            contenedorCentral.innerHTML = '<p>Aquest curs encara no té mòduls disponibles.</p>';
            return;
        }

        // --- BUCLE DE MÓDULOS ---
        curso.moduls.forEach((modul, idx) => {
            // A. Índice Lateral
            const li = document.createElement('li');
            li.innerHTML = `<a href="#mod-${idx}" class="module-link"><i class="fa-regular fa-folder"></i> ${modul.titol}</a>`;
            contenedorIndice.querySelector('ul').appendChild(li);

            // B. Contenedor del Módulo
            const modDiv = document.createElement('div');
            modDiv.id = `mod-${idx}`;
            modDiv.className = 'module-section';
            modDiv.style.marginBottom = '60px';

            // 1. Título Módulo
            const h2 = document.createElement('h2');
            h2.innerText = modul.titol;
            h2.style.borderBottom = '2px solid var(--brand-blue)';
            h2.style.paddingBottom = '10px';
            h2.style.marginBottom = '20px';
            modDiv.appendChild(h2);

            // 2. Texto (Resumen / Contenido HTML)
            if (modul.resum) {
                const textDiv = document.createElement('div');
                textDiv.className = 'module-content-text';
                textDiv.style.marginBottom = '20px';
                textDiv.innerHTML = parseStrapiRichText(modul.resum);
                modDiv.appendChild(textDiv);
            }

            // 3. MATERIAL PDF (NUEVO)
            if (modul.material_pdf && modul.material_pdf.url) {
                const pdfContainer = document.createElement('div');
                pdfContainer.style.marginBottom = '30px';
                
                const pdfBtn = document.createElement('a');
                pdfBtn.href = modul.material_pdf.url;
                pdfBtn.target = "_blank";
                pdfBtn.className = "btn-pdf"; // Clase definida en CSS
                pdfBtn.innerHTML = `<i class="fa-solid fa-file-pdf"></i> Descarregar Temari (PDF)`;
                
                pdfContainer.appendChild(pdfBtn);
                modDiv.appendChild(pdfContainer);
            }

            // 4. FLASHCARDS / TARJETAS DE MEMORIA (NUEVO)
            if (modul.targetes_memoria && modul.targetes_memoria.length > 0) {
                const flashTitle = document.createElement('h3');
                flashTitle.innerText = "Targetes de Repàs";
                flashTitle.style.marginTop = "30px";
                flashTitle.style.fontSize = "1.2rem";
                flashTitle.style.color = "var(--brand-blue)";
                modDiv.appendChild(flashTitle);

                const flashContainer = document.createElement('div');
                flashContainer.className = 'flashcards-container'; // Clase CSS Grid

                modul.targetes_memoria.forEach(card => {
                    const cardHtml = `
                        <div class="flashcard" onclick="this.classList.toggle('flipped')">
                            <div class="flashcard-inner">
                                <div class="flashcard-front">
                                    <h4>${card.pregunta}</h4>
                                    <small><i class="fa-solid fa-rotate"></i> Clica per veure la solució</small>
                                </div>
                                <div class="flashcard-back">
                                    <p>${card.resposta}</p>
                                </div>
                            </div>
                        </div>
                    `;
                    flashContainer.innerHTML += cardHtml;
                });
                modDiv.appendChild(flashContainer);
            }

            // 5. PREGUNTAS (QUIZ)
            if (modul.preguntes && modul.preguntes.length > 0) {
                const quizSection = document.createElement('div');
                quizSection.className = 'quiz-container';
                quizSection.innerHTML = `<h3 style="margin-top:40px; color:var(--brand-red); border-bottom:1px solid #eee; padding-bottom:10px;">Test d'Avaluació</h3>`;
                
                modul.preguntes.forEach((preg, pIdx) => {
                    totalPreguntas++;
                    const qId = `q-${idx}-${pIdx}`;

                    // Tarjeta
                    const card = document.createElement('div');
                    card.className = 'question-card';
                    card.id = `card-${qId}`;
                    card.dataset.id = qId;

                    // Grid Navegación
                    const gridItem = document.createElement('div');
                    gridItem.className = 'grid-item';
                    gridItem.id = `grid-${qId}`;
                    gridItem.innerText = totalPreguntas;
                    gridItem.onclick = () => card.scrollIntoView({behavior: 'smooth', block: 'center'});
                    contenedorGrid.appendChild(gridItem);

                    // HTML Pregunta
                    let htmlPreg = `
                        <div class="q-header">Pregunta ${totalPreguntas}</div>
                        <div class="q-text" style="font-size:1.1rem; font-weight:500; margin-bottom:15px;">${preg.text}</div>
                        <div class="options-list">
                    `;

                    // Opciones
                    if (preg.opcions) {
                        preg.opcions.forEach((opt, oIdx) => {
                            const isCorrect = opt.esCorrecta === true ? 'true' : 'false';
                            htmlPreg += `
                                <div class="option-item" data-val="${oIdx}" data-correct="${isCorrect}" onclick="window.seleccionarOpcion('${qId}', ${oIdx})">
                                    <input type="radio" name="${qId}" value="${oIdx}" style="pointer-events:none;">
                                    <span style="margin-left:10px;">${opt.text}</span>
                                </div>
                            `;
                        });
                    }
                    htmlPreg += `</div>`;

                    // Explicación (Feedback)
                    if (preg.explicacio) {
                        htmlPreg += `
                            <div class="explanation-box" id="explain-${qId}" style="display:none; margin-top:15px; background:#fff3cd; padding:15px; border-radius:5px;">
                                <strong>Explicació:</strong><br>${parseStrapiRichText(preg.explicacio)}
                            </div>
                        `;
                    }

                    card.innerHTML = htmlPreg;
                    quizSection.appendChild(card);
                });

                modDiv.appendChild(quizSection);
            }

            contenedorCentral.appendChild(modDiv);
        });

        // C. FOOTER (BOTÓN ACCIÓN)
        if (matriculaData.estat === 'completat') {
            mostrarPanelResultado(matriculaData.nota_final, true);
        } else {
            const footerDiv = document.createElement('div');
            footerDiv.id = 'exam-footer-action';
            footerDiv.style.textAlign = 'center';
            footerDiv.style.marginTop = '50px';
            footerDiv.style.paddingBottom = '50px';
            footerDiv.innerHTML = `
                <button class="btn-primary" onclick="window.procesarEntrega()" style="max-width:300px; padding:15px; font-size:1.1rem;">
                    Finalitzar Curs i Calcular Nota
                </button>
            `;
            contenedorCentral.appendChild(footerDiv);
        }
    }

    // ------------------------------------------------------------------------
    // 5. FUNCIONES GLOBALES (Interacción Examen)
    // ------------------------------------------------------------------------

    window.seleccionarOpcion = function(qId, valIdx) {
        if (examenEntregado) return;

        respuestasUsuario[qId] = valIdx;

        // Visual
        const card = document.getElementById(`card-${qId}`);
        const allOpts = card.querySelectorAll('.option-item');
        
        allOpts.forEach((el, idx) => {
            if (idx === valIdx) {
                el.classList.add('selected');
                el.querySelector('input').checked = true;
            } else {
                el.classList.remove('selected');
                el.querySelector('input').checked = false;
            }
        });

        // Grid
        const grid = document.getElementById(`grid-${qId}`);
        if(grid) grid.classList.add('answered');
    };

    window.procesarEntrega = async function() {
        if (!confirm("Estàs segur que vols entregar? No podràs modificar les respostes.")) return;

        const btn = document.querySelector('#exam-footer-action button');
        if(btn) { btn.innerText = "Guardant..."; btn.disabled = true; }

        let aciertos = 0;
        examenEntregado = true;

        // Corrección Visual Cliente
        const cards = document.querySelectorAll('.question-card');
        cards.forEach(card => {
            const qId = card.dataset.id;
            const options = card.querySelectorAll('.option-item');
            const feedback = card.querySelector('.explanation-box');
            const grid = document.getElementById(`grid-${qId}`);

            const userRes = respuestasUsuario[qId];
            let correctIdx = -1;

            options.forEach((opt, idx) => {
                if (opt.getAttribute('data-correct') === 'true') correctIdx = idx;
                opt.onclick = null; // Bloquear
                opt.style.cursor = 'default';
            });

            if (userRes !== undefined) {
                if (userRes === correctIdx) {
                    aciertos++;
                    options[userRes].classList.add('correct');
                    if(grid) { grid.classList.remove('answered'); grid.classList.add('correct'); }
                } else {
                    options[userRes].classList.add('wrong');
                    if(correctIdx !== -1) options[correctIdx].classList.add('correct');
                    if(grid) { grid.classList.remove('answered'); grid.classList.add('wrong'); }
                }
            } else {
                if(grid) grid.style.opacity = '0.5';
            }

            if(feedback) feedback.style.display = 'block';
        });

        // Nota
        const notaFinal = totalPreguntas > 0 ? ((aciertos / totalPreguntas) * 10).toFixed(2) : 10.00;

        // Guardar
        await guardarNotaEnStrapi(notaFinal);
    };

    async function guardarNotaEnStrapi(nota) {
        try {
            const payload = {
                data: {
                    nota_final: parseFloat(nota),
                    estat: 'completat'
                }
            };

            const res = await fetch(`${STRAPI_URL}/api/matriculas/${matriculaId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const footer = document.getElementById('exam-footer-action');
                if(footer) footer.remove();
                mostrarPanelResultado(nota, false);
            } else {
                console.error(await res.json());
                alert("Error guardant la nota. Fes una captura.");
            }
        } catch (e) {
            console.error(e);
            alert("Error de xarxa.");
        }
    }

    function mostrarPanelResultado(nota, historico) {
        const aprobado = nota >= 5;
        const color = aprobado ? 'var(--brand-blue)' : 'var(--brand-red)';
        
        const card = document.createElement('div');
        card.className = 'dashboard-card';
        card.style.marginTop = '30px';
        card.style.textAlign = 'center';
        card.style.borderTop = `5px solid ${color}`;
        
        card.innerHTML = `
            <h2 style="color:${color}; text-transform:uppercase;">${aprobado ? 'Curs Superat' : 'Nota Insuficient'}</h2>
            <div style="font-size:3.5rem; font-weight:700; color:${color}; margin:20px 0;">${nota}</div>
            <p>${aprobado ? "Enhorabona! Has aprovat." : "Has de repassar els continguts."}</p>
            
            <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
                <button class="btn-secondary" onclick="window.location.href='index.html'">Tornar a l'inici</button>
                ${aprobado ? `<button class="btn-primary" onclick="window.imprimirDiploma('${nota}')">Descarregar Diploma</button>` : ''}
            </div>
        `;

        if (historico) {
            contenedorCentral.prepend(card);
        } else {
            contenedorCentral.appendChild(card);
            card.scrollIntoView({behavior:'smooth'});
        }
    }

    // Helper Rich Text
    function parseStrapiRichText(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content.map(block => {
                if (block.type === 'paragraph' && block.children) {
                    return `<p>${block.children.map(c => c.text).join('')}</p>`;
                }
                return '';
            }).join('');
        }
        return '';
    }

    // ------------------------------------------------------------------------
    // 6. GENERADOR DIPLOMA
    // ------------------------------------------------------------------------
    window.imprimirDiploma = function(nota) {
        const nombreCurso = document.getElementById('curs-titol') ? document.getElementById('curs-titol').innerText : 'Curs de Formació';
        const fechaHoy = new Date().toLocaleDateString('ca-ES');
        const alumno = JSON.parse(localStorage.getItem('user'));

        const ventana = window.open('', '_blank');
        ventana.document.write(`
            <html>
            <head>
                <title>Diploma - SICAP</title>
                <style>
                    body { font-family: 'Georgia', serif; text-align: center; padding: 40px; }
                    .marco { border: 10px double #004B87; padding: 50px; height: 85vh; display: flex; flex-direction: column; justify-content: center; align-items: center; }
                    h1 { color: #004B87; font-size: 3rem; margin-bottom: 10px; letter-spacing: 2px; }
                    h2 { font-size: 2.2rem; margin: 20px 0; color: #333; }
                    h3 { font-size: 1.8rem; border-bottom: 1px solid #999; display: inline-block; padding: 0 30px; margin: 20px 0; }
                    p { font-size: 1.2rem; color: #555; margin: 5px 0; }
                    .firmas { margin-top: 60px; display: flex; justify-content: space-around; width: 100%; }
                    .firma { border-top: 1px solid #000; width: 250px; padding-top: 10px; font-style: italic; }
                    img { max-width: 180px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="marco">
                    <img src="img/logo-sicap.png" alt="SICAP Logo">
                    <h1>CERTIFICAT D'APROFITAMENT</h1>
                    <p>El Sindicat SICAP certifica que</p>
                    <h3>${alumno.nombre} ${alumno.apellidos || ''}</h3>
                    <p>amb DNI <strong>${alumno.username}</strong></p>
                    <p>ha superat el curs de formació:</p>
                    <h2>${nombreCurso}</h2>
                    <p>Nota Final: <strong>${nota}</strong> | Data: ${fechaHoy}</p>
                    <div class="firmas"><div class="firma">Secretari General</div><div class="firma">Secretari de Formació</div></div>
                </div>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `);
        ventana.document.close();
    };
});