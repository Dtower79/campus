// js/renderitzadorCurs.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. INICIO Y SEGURIDAD
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');

    if (!user || !token) {
        window.location.href = 'index.html';
        return;
    }

    if (!slug) {
        alert("Curs no especificat.");
        window.showView('dashboard');
        return;
    }

    // 2. REFERENCIAS DOM
    const contenedorCentral = document.getElementById('moduls-container'); 
    const contenedorIndice = document.getElementById('course-index'); 
    const contenedorGrid = document.getElementById('quiz-grid');      
    const tituloCursEl = document.getElementById('curs-titol');
    
    // Variables Globales del Script
    let matriculaId = null;
    let datosCurso = null;
    let respuestasUsuario = {}; 
    let examenEntregado = false;
    let totalPreguntas = 0;

    // INICIAR
    cargarCursoDesdeStrapi();

    // ------------------------------------------------------------------------
    // FUNCIONES DE CARGA DE DATOS
    // ------------------------------------------------------------------------
    async function cargarCursoDesdeStrapi() {
        if(contenedorCentral) contenedorCentral.innerHTML = '<div class="loader"></div><p class="loading-text">Carregant contingut...</p>';

        try {
            // Construimos la Query de Strapi "Deep Populate" manual
            // Queremos: Matricula del usuario para ESTE curso, trayendo todos los módulos y preguntas
            const query = [
                `filters[users_permissions_user][id][$eq]=${user.id}`,
                `filters[curs][slug][$eq]=${slug}`,
                `populate[curs][populate][moduls][populate][preguntes][populate][opcions]=true`, // Bajamos hasta las opciones
                `populate[curs][populate][imatge]=true`
            ].join('&');

            const url = `${STRAPI_URL}/api/matriculas?${query}`;
            
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if(!res.ok) throw new Error("Error connectant amb Strapi");
            
            const json = await res.json();

            if (!json.data || json.data.length === 0) {
                contenedorCentral.innerHTML = '<div class="alert alert-danger">No estàs matriculat en aquest curs.</div>';
                return;
            }

            // Guardamos datos clave
            const matricula = json.data[0];
            matriculaId = matricula.documentId || matricula.id; // Soporte v4/v5
            datosCurso = matricula.curs;

            // Si ya está completado, mostramos resultado directo (opcional, aquí dejamos re-hacer visualmente o mostramos nota)
            if (matricula.estat === 'completat') {
                console.log("Curs ja completat. Nota:", matricula.nota_final);
                // Podríamos mostrar un aviso, pero dejamos renderizar para repaso.
            }

            renderizarCurso(datosCurso, matricula);

        } catch (error) {
            console.error(error);
            contenedorCentral.innerHTML = `<div class="alert alert-danger">Error tècnic: ${error.message}</div>`;
        }
    }

    // ------------------------------------------------------------------------
    // RENDERIZADO VISUAL
    // ------------------------------------------------------------------------
    function renderizarCurso(curso, matriculaData) {
        // Título
        if(tituloCursEl) tituloCursEl.innerText = curso.titol;

        // Limpieza
        contenedorCentral.innerHTML = '';
        contenedorIndice.innerHTML = '<ul>';
        contenedorGrid.innerHTML = '';
        totalPreguntas = 0;

        // ¿Hay módulos?
        if (!curso.moduls || curso.moduls.length === 0) {
            contenedorCentral.innerHTML = '<p>Aquest curs no té contingut disponible.</p>';
            return;
        }

        // Iterar Módulos
        curso.moduls.forEach((modul, idx) => {
            // 1. Índice Lateral
            const li = document.createElement('li');
            li.innerHTML = `<a href="#mod-${idx}" class="module-link">${modul.titol}</a>`;
            contenedorIndice.querySelector('ul').appendChild(li);

            // 2. Renderizar Módulo
            const modDiv = document.createElement('div');
            modDiv.id = `mod-${idx}`;
            modDiv.style.marginBottom = '50px';

            // Título Módulo
            const h2 = document.createElement('h2');
            h2.innerText = modul.titol;
            h2.style.borderBottom = '2px solid var(--brand-blue)';
            h2.style.paddingBottom = '10px';
            modDiv.appendChild(h2);

            // Contenido Texto (Strapi Blocks o Texto simple)
            // Aquí simplificamos: si es array (Blocks) intentamos sacar texto, si no, lo pintamos directo.
            if (modul.resum) { // He visto 'resum' en tu captura de Modul
                const p = document.createElement('div');
                p.style.marginBottom = '20px';
                p.innerHTML = parseStrapiRichText(modul.resum); // Función helper abajo
                modDiv.appendChild(p);
            }

            // Preguntas del Módulo
            if (modul.preguntes && modul.preguntes.length > 0) {
                const quizContainer = document.createElement('div');
                quizContainer.className = 'quiz-section';
                
                modul.preguntes.forEach((preg, pIdx) => {
                    totalPreguntas++;
                    const qId = `q-${idx}-${pIdx}`; // ID único: modulo-pregunta
                    
                    // Tarjeta Pregunta
                    const card = document.createElement('div');
                    card.className = 'question-card';
                    card.id = `card-${qId}`;
                    card.dataset.id = qId;

                    // Grid Derecha
                    const gridBox = document.createElement('div');
                    gridBox.className = 'grid-item';
                    gridBox.id = `grid-${qId}`;
                    gridBox.innerText = totalPreguntas;
                    gridBox.onclick = () => card.scrollIntoView({behavior: 'smooth', block: 'center'});
                    contenedorGrid.appendChild(gridBox);

                    // HTML Pregunta
                    let htmlPregunta = `
                        <div class="q-header">Pregunta ${totalPreguntas}</div>
                        <div class="q-text">${preg.text}</div>
                        <div class="options-area">
                    `;

                    // Opciones
                    if (preg.opcions) {
                        preg.opcions.forEach((opt, oIdx) => {
                            // IMPORTANTE: Guardamos si es correcta en un atributo data cifrado o simple
                            // Para seguridad real esto se valida en servidor, pero para este LMS lo hacemos en cliente.
                            const esCorrectaStr = opt.esCorrecta ? 'true' : 'false';
                            
                            htmlPregunta += `
                                <div class="option-item" data-val="${oIdx}" data-correct="${esCorrectaStr}" onclick="seleccionarOpcion('${qId}', ${oIdx})">
                                    <input type="radio" name="${qId}" class="option-radio" value="${oIdx}">
                                    <span>${opt.text}</span>
                                </div>
                            `;
                        });
                    }

                    htmlPregunta += `</div>`; // Cierre options-area
                    
                    // Feedback (oculto inicialmente)
                    const explicacioText = parseStrapiRichText(preg.explicacio || '');
                    if (explicacioText) {
                        htmlPregunta += `
                            <div class="explanation-box" id="explain-${qId}">
                                <strong>Explicació:</strong> ${explicacioText}
                            </div>
                        `;
                    }

                    card.innerHTML = htmlPregunta;
                    quizContainer.appendChild(card);
                });

                modDiv.appendChild(quizContainer);
            }

            contenedorCentral.appendChild(modDiv);
        });

        // Botón Finalizar (solo si no está entregado)
        // Si el curso ya estaba completado, mostramos el botón de diploma directamente
        if (matriculaData.estat === 'completat') {
            mostrarPanelResultado(matriculaData.nota_final, true);
        } else {
            const btnDiv = document.createElement('div');
            btnDiv.id = 'action-area';
            btnDiv.style.textAlign = 'center';
            btnDiv.style.marginTop = '40px';
            btnDiv.innerHTML = `<button class="btn-primary" onclick="procesarEntrega()" style="max-width:300px; font-size:1.2rem;">Finalitzar i Calcular Nota</button>`;
            contenedorCentral.appendChild(btnDiv);
        }
    }

    // ------------------------------------------------------------------------
    // LÓGICA DE EXAMEN
    // ------------------------------------------------------------------------
    window.seleccionarOpcion = function(qId, valIdx) {
        if (examenEntregado) return;

        // Guardar respuesta
        respuestasUsuario[qId] = valIdx;

        // Visual
        const card = document.getElementById(`card-${qId}`);
        const inputs = card.querySelectorAll('.option-item');
        inputs.forEach(opt => {
            opt.classList.remove('selected');
            opt.style.backgroundColor = 'var(--bg-card)';
            opt.querySelector('input').checked = false;
        });

        // Marcar seleccionado
        const selected = inputs[valIdx];
        if(selected) {
            selected.classList.add('selected');
            selected.style.backgroundColor = 'var(--selected-bg)';
            selected.querySelector('input').checked = true;
        }

        // Grid
        const gridBox = document.getElementById(`grid-${qId}`);
        if(gridBox) gridBox.classList.add('answered');
    };

    window.procesarEntrega = async function() {
        if (!confirm("Segur que vols entregar? No podràs canviar les respostes.")) return;
        
        const btn = document.querySelector('#action-area button');
        if(btn) { btn.disabled = true; btn.innerText = "Calculant..."; }

        let aciertos = 0;
        let contestadas = 0;

        // Corregir visualmente
        const cards = document.querySelectorAll('.question-card');
        
        cards.forEach(card => {
            const qId = card.dataset.id;
            const options = card.querySelectorAll('.option-item');
            const userVal = respuestasUsuario[qId];
            const feedback = card.querySelector('.explanation-box');
            const gridBox = document.getElementById(`grid-${qId}`);

            // Buscar índice correcto
            let correctIdx = -1;
            options.forEach((opt, idx) => {
                if (opt.getAttribute('data-correct') === 'true') correctIdx = idx;
                // Bloquear clicks
                opt.onclick = null;
                opt.querySelector('input').disabled = true;
            });

            if (userVal !== undefined) {
                contestadas++;
                if (userVal === correctIdx) {
                    aciertos++;
                    // Visual Acierto
                    options[userVal].classList.add('correct');
                    if(gridBox) { gridBox.classList.remove('answered'); gridBox.classList.add('correct'); }
                } else {
                    // Visual Fallo
                    options[userVal].classList.add('wrong');
                    if(correctIdx !== -1) options[correctIdx].classList.add('correct'); // Mostrar cuál era
                    if(gridBox) { gridBox.classList.remove('answered'); gridBox.classList.add('wrong'); }
                }
            } else {
                // No contestada
                if(gridBox) gridBox.style.opacity = '0.5';
            }

            // Mostrar explicación
            if(feedback) feedback.style.display = 'block';
        });

        examenEntregado = true;

        // Calcular Nota
        const nota = totalPreguntas > 0 ? ((aciertos / totalPreguntas) * 10).toFixed(2) : 10; // Si no hay preguntas, es 10.
        
        // Guardar en Strapi
        await guardarNotaStrapi(nota);
    };

    async function guardarNotaStrapi(nota) {
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
                // Borrar botón y mostrar resultado
                const actionArea = document.getElementById('action-area');
                if(actionArea) actionArea.remove();
                mostrarPanelResultado(nota, false);
            } else {
                alert("Error guardant la nota al servidor. Fes una captura.");
                console.error(await res.json());
            }

        } catch (e) {
            console.error(e);
            alert("Error de connexió.");
        }
    }

    function mostrarPanelResultado(nota, yaEstabaCompletado) {
        const aprobado = nota >= 5;
        const color = aprobado ? 'var(--brand-blue)' : 'var(--brand-red)';
        const texto = aprobado ? 'Curs Superat' : 'Nota Insuficient';
        
        const panel = document.createElement('div');
        panel.className = 'dashboard-card';
        panel.style.textAlign = 'center';
        panel.style.marginTop = '30px';
        panel.style.borderTop = `5px solid ${color}`;

        let html = `
            <h2 style="color:${color}">${texto}</h2>
            <div style="font-size:3rem; font-weight:bold; margin:20px 0;">${parseFloat(nota).toFixed(1)}</div>
            <p>${aprobado ? "Enhorabona! Ja pots descarregar el teu certificat." : "Pots tornar a repassar el temari."}</p>
            <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
                <button class="btn-secondary" onclick="window.location.href='index.html'">Tornar a l'Inici</button>
        `;

        if (aprobado) {
            html += `<button class="btn-primary" onclick="imprimirDiploma('${nota}')">Descarregar Diploma</button>`;
        }
        
        html += `</div>`;
        panel.innerHTML = html;

        if (yaEstabaCompletado) {
            // Si ya estaba completado, lo ponemos al principio
            contenedorCentral.prepend(panel);
        } else {
            // Si acabamos de terminar, al final
            contenedorCentral.appendChild(panel);
            panel.scrollIntoView({behavior:'smooth'});
        }
    }

    // Helper simple para Rich Text de Strapi (Blocks o Texto)
    function parseStrapiRichText(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            // Lógica muy básica para Blocks: extraer 'text' de los children
            return content.map(block => {
                if (block.children) {
                    return block.children.map(child => child.text).join('');
                }
                return '';
            }).join('<br><br>');
        }
        return '';
    }

    // ------------------------------------------------------------------------
    // DIPLOMA
    // ------------------------------------------------------------------------
    window.imprimirDiploma = function(nota) {
        const cursoNombre = tituloCursEl ? tituloCursEl.innerText : "Curs SICAP";
        const fecha = new Date().toLocaleDateString('ca-ES');
        
        const diplomaWindow = window.open('', '_blank');
        diplomaWindow.document.write(`
            <html>
            <head>
                <title>Diploma SICAP</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; text-align: center; }
                    .border { border: 15px double #004B87; padding: 50px; height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; }
                    h1 { color: #004B87; font-size: 3rem; margin-bottom: 10px; text-transform: uppercase; }
                    h2 { font-size: 2rem; margin: 10px 0; font-weight: normal; }
                    h3 { font-size: 2.5rem; margin: 20px 0; border-bottom: 2px solid #333; display: inline-block; padding: 0 20px; }
                    p { font-size: 1.2rem; margin: 5px 0; color: #555; }
                    .logo { max-width: 150px; margin-bottom: 30px; }
                    .footer { margin-top: 60px; display: flex; justify-content: space-around; width: 100%; }
                    .sign { border-top: 1px solid #333; width: 200px; padding-top: 10px; font-style: italic; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="border">
                    <img src="img/logo-sicap.png" class="logo" alt="SICAP">
                    <h1>Certificat d'Aprofitament</h1>
                    <p>Es certifica que</p>
                    <h3>${user.nombre} ${user.apellidos || ''}</h3>
                    <p>amb DNI <strong>${user.username}</strong></p>
                    <p>ha superat satisfactòriament el curs:</p>
                    <h2 style="color:#004B87; font-weight:bold;">${cursoNombre}</h2>
                    <p>Data: ${fecha} - Nota: ${nota}</p>
                    
                    <div class="footer">
                        <div class="sign">Secretari General</div>
                        <div class="sign">Secretari de Formació</div>
                    </div>
                </div>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `);
        diplomaWindow.document.close();
    };
});