// Arxiu: js/renderitzadorCurs.js

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
        .then(res => {
            if (!res.ok) throw new Error("Error de xarxa");
            return res.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            renderCourse(data); 
        })
        .catch(error => {
            console.error("Error en carregar les dades del curs:", error);
            document.getElementById('container').innerHTML = `<h1>Error al carregar el curs.</h1><p>${error.message}</p>`;
        });
});

function renderCourse(courseData) {
    document.title = courseData.titol;
    document.getElementById('curs-titol').innerText = courseData.titol;
    
    // Gestió de la descripció del curs (Rich Text vs Text)
    let descText = '';
    if (typeof courseData.descripcio === 'string') {
        descText = courseData.descripcio;
    } else if (Array.isArray(courseData.descripcio) && courseData.descripcio[0]?.children) {
        descText = courseData.descripcio[0].children[0].text;
    }
    document.getElementById('curs-descripcio').innerText = descText;

    const modulsContainer = document.getElementById('moduls-container');
    modulsContainer.innerHTML = '';
    
    if (!courseData.moduls || courseData.moduls.length === 0) {
         modulsContainer.innerHTML = '<p>Aquest curs encara no té mòduls.</p>';
        return;
    }
    
    courseData.moduls.forEach(modul => {
        const modulData = modul; 
        const moduleEl = document.createElement('div');
        moduleEl.className = 'module';
        
        let preguntesHTML = '<div class="quiz"><h4>Autoavaluació</h4>';
        
        if (modulData.preguntes && modulData.preguntes.length > 0) {
            modulData.preguntes.forEach((pregunta, preguntaIndex) => {
                let opcionsHTML = '<ul class="options">';
                
                if (pregunta.opcions && Array.isArray(pregunta.opcions)) {
                    pregunta.opcions.forEach((opcio) => {
                        opcionsHTML += `<li data-correct="${opcio.esCorrecta}">${opcio.text}</li>`;
                    });
                }
                opcionsHTML += '</ul>';
                
                // --- CORRECCIÓ DE L'EXPLICACIÓ ---
                // Aquí és on arreglem l'[object Object].
                // Mirem si és text pla o Rich Text i traiem el contingut real.
                let textExplicacio = '';
                if (typeof pregunta.explicacio === 'string') {
                    // Cas A: És text normal
                    textExplicacio = pregunta.explicacio;
                } else if (Array.isArray(pregunta.explicacio) && pregunta.explicacio[0]?.children) {
                    // Cas B: És Rich Text de Strapi (Array de blocs)
                    textExplicacio = pregunta.explicacio[0].children[0].text;
                } else {
                    // Cas C: Per si de cas falla tot
                    textExplicacio = 'Mira la normativa per a més detalls.';
                }

                preguntesHTML += `
                    <div class="question" id="q-${pregunta.id}-${preguntaIndex}">
                        <p>${preguntaIndex + 1}. ${pregunta.text}</p>
                        ${opcionsHTML}
                        <div class="explanation" style="display:none;">${textExplicacio}</div>
                    </div>
                `;
            });
        } else {
            preguntesHTML += '<p>No hi ha preguntes en aquest mòdul.</p>';
        }
        preguntesHTML += '</div>';

        moduleEl.innerHTML = `<h3>${modulData.titol}</h3><p class="summary">${modulData.resum}</p>${preguntesHTML}`;
        modulsContainer.appendChild(moduleEl);
    });
    
    addQuizInteractivity();
}

function addQuizInteractivity() {
    document.querySelectorAll('.options li').forEach(opcio => {
        opcio.addEventListener('click', (event) => {
            const questionDiv = event.target.closest('.question');
            if (questionDiv.classList.contains('answered')) return;
            
            questionDiv.classList.add('answered');
            const isCorrect = event.target.dataset.correct === 'true';
            
            if (isCorrect) {
                event.target.style.backgroundColor = '#4CAF50';
                event.target.style.color = 'white';
            } else {
                event.target.style.backgroundColor = '#F44336';
                event.target.style.color = 'white';
                
                const correctOption = questionDiv.querySelector('li[data-correct="true"]');
                if(correctOption) correctOption.style.backgroundColor = '#a5d6a7';
            }
            
            const explicacio = questionDiv.querySelector('.explanation');
            if (explicacio) explicacio.style.display = 'block';
        });
    });
}