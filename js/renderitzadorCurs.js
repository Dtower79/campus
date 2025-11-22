let currentCourseData = null; // Guardem les dades globals del curs
let userAnswers = {};         // Guardarem les respostes aquí: { "q-1-1": 2 } (preguntaID: opcioIndex)
let isExamFinished = false;   // Per bloquejar canvis un cop corregit

window.addEventListener('load', () => {
    // Verificación de usuario (Si usas Netlify Identity)
    if (typeof netlifyIdentity !== 'undefined' && !netlifyIdentity.currentUser()) {
        // Si no hay usuario, redirigir (descomenta si es necesario)
        // window.location.replace('/');
        // return;
    }

    const params = new URLSearchParams(window.location.search);
    const courseSlug = params.get('slug');

    if (!courseSlug) {
        document.body.innerHTML = '<h1>Error: No s\'ha especificat cap curs.</h1>';
        return;
    }
    
    fetch(`/.netlify/functions/dadesCurs?slug=${courseSlug}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            currentCourseData = data; // Guardem dades globalment
            renderCourseLayout(data); 
        })
        .catch(error => {
            console.error("Error:", error);
            const titolEl = document.getElementById('curs-titol');
            if(titolEl) titolEl.innerText = "Error al carregar";
        });
});

function renderCourseLayout(courseData) {
    // 1. Títols
    document.title = courseData.titol;
    const titolEl = document.getElementById('curs-titol');
    if(titolEl) titolEl.innerText = courseData.titol;
    
    // --- PARCHE RICH TEXT (Descripció) ---
    let descText = "";
    if (courseData.descripcio) {
        if (Array.isArray(courseData.descripcio)) {
            descText = courseData.descripcio.map(b => b.children.map(c => c.text).join('')).join('\n');
        } else {
            descText = courseData.descripcio;
        }
    }
    const descEl = document.getElementById('curs-descripcio');
    if(descEl) descEl.innerText = descText;

    // 2. Índex Esquerre
    const indexContainer = document.getElementById('course-index');
    if (indexContainer) {
        indexContainer.innerHTML = '';
        if(courseData.moduls) {
            courseData.moduls.forEach((mod) => {
                const link = document.createElement('a');
                link.className = 'module-link';
                link.href = `#modul-${mod.id}`;
                link.innerHTML = `<i class="fas fa-folder"></i> ${mod.titol}`;
                indexContainer.appendChild(link);
            });
        }
    }

    // 3. Contingut Central
    const contentContainer = document.getElementById('moduls-container');
    contentContainer.innerHTML = '';

    // Caixa de Nota (La creem però la deixem oculta)
    const scoreDiv = document.createElement('div');
    scoreDiv.id = 'final-score-card';
    scoreDiv.className = 'score-card';
    scoreDiv.style.display = 'none'; // Oculta por defecto
    contentContainer.appendChild(scoreDiv);

    const quizGridContainer = document.getElementById('quiz-grid');
    if(quizGridContainer) quizGridContainer.innerHTML = '';

    let globalQuestionCounter = 0;

    if (!courseData.moduls || courseData.moduls.length === 0) {
        contentContainer.innerHTML = '<p>No hi ha mòduls.</p>';
        return;
    }

    courseData.moduls.forEach(modul => {
        const moduleTitle = document.createElement('div');
        moduleTitle.id = `modul-${modul.id}`;
        // Usamos el resumen si existe, si no cadena vacía
        const resumen = modul.resum || "";
        moduleTitle.innerHTML = `<h2 style="border-bottom: 2px solid var(--primary-color); padding-bottom:10px; margin-top:40px;">${modul.titol}</h2><p>${resumen}</p>`;
        contentContainer.appendChild(moduleTitle);

        if (modul.preguntes && modul.preguntes.length > 0) {
            modul.preguntes.forEach((preg) => {
                globalQuestionCounter++;
                
                // Renderitzar Targeta de Pregunta
                const qCard = createExamQuestionCard(preg, globalQuestionCounter);
                contentContainer.appendChild(qCard);

                // Renderitzar Grid Dret (Si existe el contenedor)
                if (quizGridContainer) {
                    const gridItem = document.createElement('div');
                    gridItem.className = 'grid-item';
                    gridItem.id = `grid-q-${globalQuestionCounter}`;
                    gridItem.innerText = globalQuestionCounter;
                    gridItem.onclick = () => {
                        const qElement = document.getElementById(`question-${globalQuestionCounter}`);
                        if(qElement) qElement.scrollIntoView({behavior: "smooth"});
                    };
                    quizGridContainer.appendChild(gridItem);
                }
            });
        }
    });

    // 4. Botó Finalitzar
    if (globalQuestionCounter > 0) {
        const actionArea = document.createElement('div');
        actionArea.className = 'action-area';
        actionArea.innerHTML = `<button id="btn-submit" class="btn-finish"><i class="fas fa-check-circle"></i> Entregar i Corregir</button>`;
        contentContainer.appendChild(actionArea);

        const btnSubmit = document.getElementById('btn-submit');
        if(btnSubmit) btnSubmit.addEventListener('click', calculateAndShowResults);
        
        // També vinculem l'enllaç de la barra dreta
        const finishLink = document.getElementById('finish-review');
        if(finishLink) {
            finishLink.addEventListener('click', (e) => {
                e.preventDefault();
                calculateAndShowResults();
            });
        }
    }
}

function createExamQuestionCard(pregunta, qNum) {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `question-${qNum}`;
    // Guardem l'ID real de la pregunta per buscar-la després
    card.dataset.questionId = qNum; 

    // Caixa Info (Izquierda)
    const infoBox = document.createElement('div');
    infoBox.className = 'q-number-box';
    infoBox.innerHTML = `
        <span class="q-state" style="font-weight:bold; display:block; margin-bottom:5px;">Pregunta ${qNum}</span>
        <span class="q-state" id="status-${qNum}" style="font-weight:normal; font-size:0.8rem;">Sense respondre</span>
        <div class="q-points" style="margin-top:5px; font-size:0.8rem; color:#666;">Puntua sobre 1,00</div>
    `;

    // Caixa Contingut (Derecha)
    const contentBox = document.createElement('div');
    contentBox.className = 'q-content-box';

    // --- PARCHE TEXTO ENUNCIADO ---
    // Usamos 'text' (nuevo) o 'titol' (viejo)
    const textoEnunciado = pregunta.text || pregunta.titol || "Sense enunciat";

    const qText = document.createElement('div');
    qText.className = 'q-text-area';
    qText.innerHTML = `<p>${textoEnunciado}</p>`;
    contentBox.appendChild(qText);

    const optionsList = document.createElement('div');
    optionsList.className = 'options-list';
    optionsList.id = `options-list-${qNum}`;

    if (pregunta.opcions) {
        pregunta.opcions.forEach((opcio, idx) => {
            const optRow = document.createElement('div');
            optRow.className = 'option-item';
            optRow.dataset.idx = idx; // Guardem l'índex (0, 1, 2, 3)
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `q-${qNum}`; 
            radio.className = 'option-radio';
            
            const label = document.createElement('span');
            // Letras a, b, c, d
            label.innerText = `${String.fromCharCode(97 + idx)}. ${opcio.text}`; 

            optRow.appendChild(radio);
            optRow.appendChild(label);

            // LÒGICA DE SELECCIÓ (NO CORRECCIÓ)
            optRow.addEventListener('click', () => {
                if (isExamFinished) return; // Si ja hem acabat, no deixar canviar
                
                // 1. Marcar visualment
                // Treure classe 'selected' de les altres opcions d'aquesta pregunta
                const siblings = optionsList.querySelectorAll('.option-item');
                siblings.forEach(el => {
                    el.classList.remove('selected');
                    const inp = el.querySelector('input');
                    if(inp) inp.checked = false;
                });

                // Afegir a la actual
                optRow.classList.add('selected');
                radio.checked = true;

                // 2. Guardar resposta en memòria
                userAnswers[qNum] = idx; 

                // 3. Actualitzar estat visual (Respost)
                const statusEl = document.getElementById(`status-${qNum}`);
                if(statusEl) statusEl.innerText = "Resposta guardada";
                
                const gridEl = document.getElementById(`grid-q-${qNum}`);
                if(gridEl) gridEl.style.backgroundColor = "#e0e0e0"; 
            });

            optionsList.appendChild(optRow);
        });
    }

    // --- PARCHE RICH TEXT (Explicació) ---
    const expBox = document.createElement('div');
    expBox.className = 'explanation-box';
    expBox.id = `explanation-${qNum}`;
    expBox.style.display = 'none';
    
    // Lógica para sacar el texto sea String o Bloques
    let explicacioText = "Sense explicació addicional.";
    if (pregunta.explicacio) {
        if (Array.isArray(pregunta.explicacio)) {
            explicacioText = pregunta.explicacio.map(b => b.children.map(c => c.text).join('')).join('<br>');
        } else if (typeof pregunta.explicacio === 'string') {
            explicacioText = pregunta.explicacio;
        }
    }
    
    // Cambiamos "Retroalimentació" por "Explicació" como pediste
    expBox.innerHTML = `<strong>Explicació:</strong><br>${explicacioText}`;
    
    contentBox.appendChild(optionsList);
    contentBox.appendChild(expBox);
    
    card.appendChild(infoBox);
    card.appendChild(contentBox);

    return card;
}

function calculateAndShowResults() {
    if (isExamFinished) return; // Evitar doble click
    if (!confirm("Segur que vols entregar l'examen i veure la nota?")) return;

    isExamFinished = true; // Bloquejar canvis
    let encerts = 0;
    let totalPreguntes = 0;

    // Recorrem les dades originals per comparar
    let qCounter = 0;
    currentCourseData.moduls.forEach(modul => {
        if (modul.preguntes) {
            modul.preguntes.forEach(preg => {
                qCounter++;
                totalPreguntes++;

                const userSelectionIdx = userAnswers[qCounter]; 
                const optionsListDOM = document.getElementById(`options-list-${qCounter}`);
                const statusDOM = document.getElementById(`status-${qCounter}`);
                const gridItemDOM = document.getElementById(`grid-q-${qCounter}`);
                const explanationDOM = document.getElementById(`explanation-${qCounter}`);

                // Busquem quina era la correcta a les dades
                let correctIdx = -1;
                if(preg.opcions) {
                    preg.opcions.forEach((opt, i) => {
                        if (opt.esCorrecta) correctIdx = i;
                    });
                }

                // CORREGIR VISUALMENT
                const domOptions = optionsListDOM.querySelectorAll('.option-item');
                
                // 1. Marcar la correcta en VERD sempre
                if(correctIdx !== -1 && domOptions[correctIdx]) {
                    domOptions[correctIdx].classList.add('correct');
                }

                // 2. Si l'usuari ha fallat, marcar la seva en VERMELL
                if (userSelectionIdx !== undefined) {
                    if (parseInt(userSelectionIdx) === correctIdx) {
                        encerts++;
                        if(statusDOM) {
                            statusDOM.innerText = "Correcta";
                            statusDOM.style.color = "green";
                            statusDOM.style.fontWeight = "bold";
                        }
                        if(gridItemDOM) {
                            gridItemDOM.className = 'grid-item correct'; 
                            gridItemDOM.innerHTML = '<i class="fas fa-check"></i>';
                        }
                    } else {
                        if(domOptions[userSelectionIdx]) {
                            domOptions[userSelectionIdx].classList.add('wrong');
                            domOptions[userSelectionIdx].classList.remove('selected'); 
                        }
                        if(statusDOM) {
                            statusDOM.innerText = "Incorrecta";
                            statusDOM.style.color = "red";
                            statusDOM.style.fontWeight = "bold";
                        }
                        if(gridItemDOM) {
                            gridItemDOM.className = 'grid-item wrong'; 
                            gridItemDOM.innerHTML = '<i class="fas fa-times"></i>';
                        }
                    }
                } else {
                    if(statusDOM) {
                        statusDOM.innerText = "Sense respondre";
                        statusDOM.style.color = "orange";
                    }
                    if(gridItemDOM) {
                        gridItemDOM.className = 'grid-item wrong'; 
                        gridItemDOM.innerHTML = '<i class="fas fa-minus"></i>';
                    }
                }

                // 3. Mostrar Explicació
                if(explanationDOM) explanationDOM.style.display = 'block';
            });
        }
    });

    // CALCULAR NOTA (Sobre 10)
    const nota = totalPreguntes > 0 ? (encerts / totalPreguntes) * 10 : 0;
    let missatge = "";
    if (nota >= 5) missatge = "Enhorabona! Has superat el mòdul.";
    else missatge = "Has de repassar el temari.";

    // MOSTRAR TARGETA DE RESULTATS
    const scoreCard = document.getElementById('final-score-card');
    if (scoreCard) {
        scoreCard.innerHTML = `
            <h3 style="text-align:center;">Resultats de l'intent</h3>
            <span class="score-number" style="display:block; text-align:center; font-size:3rem; color:var(--primary-color); margin:10px 0;">${nota.toFixed(2)} / 10.00</span>
            <p class="score-message" style="text-align:center; font-size:1.2rem; color:#666;">${missatge}</p>
            <p style="text-align:center;">Has encertat <strong>${encerts}</strong> de <strong>${totalPreguntes}</strong> preguntes.</p>
        `;
        scoreCard.style.display = 'block';
        scoreCard.scrollIntoView({ behavior: 'smooth' });
    }

    // Desactivar botó
    const btnSubmit = document.getElementById('btn-submit');
    if(btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Examen Corregit";
        btnSubmit.style.backgroundColor = "#999";
        btnSubmit.style.cursor = "not-allowed";
    }
}