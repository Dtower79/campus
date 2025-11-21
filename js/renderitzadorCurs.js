window.addEventListener('load', () => {
    if (!netlifyIdentity.currentUser()) {
        window.location.replace('/');
        return;
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
            renderCourseLayout(data); 
        })
        .catch(error => {
            console.error("Error:", error);
            document.getElementById('curs-titol').innerText = "Error al carregar";
        });
});

function renderCourseLayout(courseData) {
    // 1. Títulos
    document.title = courseData.titol;
    document.getElementById('curs-titol').innerText = courseData.titol;
    
    let descText = typeof courseData.descripcio === 'string' ? courseData.descripcio : (courseData.descripcio?.[0]?.children?.[0]?.text || '');
    document.getElementById('curs-descripcio').innerText = descText;

    // 2. Índice Izquierdo
    const indexContainer = document.getElementById('course-index');
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

    // 3. Contenido y Grid Derecho
    const contentContainer = document.getElementById('moduls-container');
    contentContainer.innerHTML = '';

    const quizGridContainer = document.getElementById('quiz-grid');
    quizGridContainer.innerHTML = '';

    let globalQuestionCounter = 0;

    if (!courseData.moduls || courseData.moduls.length === 0) {
        contentContainer.innerHTML = '<p>No hi ha mòduls.</p>';
        return;
    }

    courseData.moduls.forEach(modul => {
        const moduleTitle = document.createElement('div');
        moduleTitle.id = `modul-${modul.id}`;
        moduleTitle.innerHTML = `<h2 style="border-bottom: 2px solid var(--primary-color); padding-bottom:10px; margin-top:40px;">${modul.titol}</h2><p>${modul.resum}</p>`;
        contentContainer.appendChild(moduleTitle);

        if (modul.preguntes && modul.preguntes.length > 0) {
            modul.preguntes.forEach((preg) => {
                globalQuestionCounter++;
                
                // A. Pregunta Central
                const qCard = createMoodleQuestionCard(preg, globalQuestionCounter);
                contentContainer.appendChild(qCard);

                // B. Grid Derecho
                const gridItem = document.createElement('div');
                gridItem.className = 'grid-item';
                gridItem.id = `grid-q-${globalQuestionCounter}`;
                gridItem.innerText = globalQuestionCounter;
                gridItem.onclick = () => {
                    document.getElementById(`question-${globalQuestionCounter}`).scrollIntoView({behavior: "smooth"});
                };
                quizGridContainer.appendChild(gridItem);
            });
        }
    });
}

function createMoodleQuestionCard(pregunta, qNum) {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `question-${qNum}`;

    // Caja Info Izquierda
    const infoBox = document.createElement('div');
    infoBox.className = 'q-number-box';
    infoBox.innerHTML = `
        <span class="q-state">Pregunta ${qNum}</span>
        <span class="q-state" id="status-${qNum}" style="font-weight:normal; font-size:0.8rem;">Sense respondre</span>
        <div class="q-points" style="margin-top:5px;">Puntua sobre 1,00</div>
    `;

    // Caja Contenido Derecha
    const contentBox = document.createElement('div');
    contentBox.className = 'q-content-box';

    const qText = document.createElement('div');
    qText.className = 'q-text-area';
    qText.innerHTML = `<p>${pregunta.text}</p>`;
    contentBox.appendChild(qText);

    const optionsList = document.createElement('div');
    optionsList.className = 'options-list';
    
    let explicacioText = typeof pregunta.explicacio === 'string' ? pregunta.explicacio : (pregunta.explicacio?.[0]?.children?.[0]?.text || 'Veure normativa.');

    if (pregunta.opcions) {
        pregunta.opcions.forEach((opcio, idx) => {
            const optRow = document.createElement('div');
            optRow.className = 'option-item';
            optRow.dataset.correct = opcio.esCorrecta; 
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `q-${qNum}`; 
            radio.className = 'option-radio';
            
            const label = document.createElement('span');
            label.innerText = `${String.fromCharCode(97 + idx)}. ${opcio.text}`; 

            optRow.appendChild(radio);
            optRow.appendChild(label);

            // CLICK: Lógica de Feedback Inmediato
            optRow.addEventListener('click', () => {
                if (contentBox.classList.contains('answered')) return; 
                
                contentBox.classList.add('answered');
                radio.checked = true;
                document.getElementById(`status-${qNum}`).innerText = "Finalitzat";

                const gridItem = document.getElementById(`grid-q-${qNum}`);

                if (opcio.esCorrecta) {
                    optRow.classList.add('correct');
                    gridItem.classList.add('correct');
                    gridItem.innerHTML = `<i class="fas fa-check"></i>`;
                } else {
                    optRow.classList.add('wrong');
                    gridItem.classList.add('wrong');
                    gridItem.innerHTML = `<i class="fas fa-times"></i>`;
                    
                    // Marcar la correcta en verde
                    const allOptions = optionsList.querySelectorAll('.option-item');
                    allOptions.forEach(opt => {
                        if (opt.dataset.correct === 'true') {
                            opt.classList.add('correct');
                        }
                    });
                }

                const expBox = document.createElement('div');
                expBox.className = 'explanation-box';
                expBox.innerHTML = `<strong>Retroalimentació:</strong><br>${explicacioText}`;
                contentBox.appendChild(expBox);
            });

            optionsList.appendChild(optRow);
        });
    }

    contentBox.appendChild(optionsList);
    card.appendChild(infoBox);
    card.appendChild(contentBox);

    return card;
}