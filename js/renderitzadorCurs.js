// Aquest codi s'espera a que tota la pàgina estigui carregada.
window.addEventListener('load', () => {
    
    // El nostre guardià de seguretat.
    if (!netlifyIdentity.currentUser()) {
        window.location.replace('/');
        return;
    }

    // Llegim la URL per saber quin curs hem de carregar.
    // ex: /curs.html?slug=iniciacio-regim-disciplinari
    const params = new URLSearchParams(window.location.search);
    const courseSlug = params.get('slug');

    if (!courseSlug) {
        document.body.innerHTML = '<h1>Error: No s\'ha especificat cap curs.</h1>';
        return;
    }

    // Cridem a la funció de backend 'dadesCurs.js' que ja vam crear.
    fetch(`/.netlify/functions/dadesCurs?slug=${courseSlug}`)
        .then(res => {
            if (!res.ok) throw new Error('No s\'ha pogut carregar el curs');
            return res.json();
        })
        .then(data => {
            renderCourse(data);
        })
        .catch(error => {
            console.error("Error al carregar les dades del curs:", error);
            document.getElementById('container').innerHTML = `<h1>Error al carregar el curs.</h1>`;
        });
});

// Funció principal que construeix la pàgina del curs amb les dades rebudes.
function renderCourse(courseData) {
    document.title = courseData.titol; // Canviem el títol de la pestanya del navegador.
    document.getElementById('curs-titol').innerText = courseData.titol;
    document.getElementById('curs-descripcio').innerText = courseData.descripcio;

    const modulsContainer = document.getElementById('moduls-container');
    modulsContainer.innerHTML = ''; // Netegem el missatge de "Carregant..."

    if (!courseData.moduls || courseData.moduls.length === 0) {
        modulsContainer.innerHTML = '<p>Aquest curs encara no té mòduls.</p>';
        return;
    }

    // Per cada mòdul que rebem de la base de dades...
    courseData.moduls.forEach(modul => {
        const moduleEl = document.createElement('div');
        moduleEl.className = 'module';
        
        // Construïm la part de les preguntes (quiz)
        let preguntesHTML = '<div class="quiz"><h4>Autoavaluació</h4>';
        modul.preguntes.forEach((pregunta, preguntaIndex) => {
            
            let opcionsHTML = '<ul class="options">';
            pregunta.opcions.forEach((opcio, opcioIndex) => {
                opcionsHTML += `<li data-correct="${opcio.correct}">${opcio.text}</li>`;
            });
            opcionsHTML += '</ul>';
            
            preguntesHTML += `
                <div class="question" id="q-${modul.id}-${preguntaIndex}">
                    <p>${preguntaIndex + 1}. ${pregunta.pregunta}</p>
                    ${opcionsHTML}
                    <div class="explanation">${pregunta.explicacio}</div>
                </div>
            `;
        });
        preguntesHTML += '</div>';

        moduleEl.innerHTML = `
            <h3>${modul.titol}</h3>
            <p class="summary">${modul.resum}</p>
            ${preguntesHTML}
        `;
        modulsContainer.appendChild(moduleEl);
    });
    
    // Un cop tot l'HTML està a la pàgina, afegim la interactivitat.
    addQuizInteractivity();
}

// Funció que afegeix la lògica de clic a totes les opcions del quiz.
function addQuizInteractivity() {
    document.querySelectorAll('.options li').forEach(opcio => {
        opcio.addEventListener('click', (event) => {
            const questionDiv = event.target.closest('.question');
            if (questionDiv.classList.contains('answered')) return; // No permetre respondre dos cops

            questionDiv.classList.add('answered');
            const isCorrect = event.target.dataset.correct === 'true';

            if (isCorrect) {
                event.target.style.backgroundColor = '#4CAF50'; // verd
                event.target.style.color = 'white';
            } else {
                event.target.style.backgroundColor = '#F44336'; // vermell
                event.target.style.color = 'white';
                // Mostrem quina era la correcta
                questionDiv.querySelector('li[data-correct="true"]').style.backgroundColor = '#a5d6a7';
            }

            // Mostrem l'explicació
            questionDiv.querySelector('.explanation').style.display = 'block';
        });
    });
}