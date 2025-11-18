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
    
    // Cridem a la funció de backend, que ara parlarà amb Strapi.
    fetch(`/.netlify/functions/dadesCurs?slug=${courseSlug}`)
        .then(res => res.json())
        .then(data => {
            // La nostra funció ja ens retorna l'objecte del curs net.
            // Les dades principals estan a la propietat 'attributes'.
            renderCourse(data.attributes); 
        })
        .catch(error => {
            console.error("Error en carregar les dades del curs:", error);
            document.getElementById('container').innerHTML = `<h1>Error al carregar el curs.</h1>`;
        });
});

function renderCourse(courseData) {
    document.title = courseData.titol;
    document.getElementById('curs-titol').innerText = courseData.titol;
    
    // La descripció de Strapi és un objecte complex, n'extraiem el text.
    const descText = courseData.descripcio[0]?.children[0]?.text || '';
    document.getElementById('curs-descripcio').innerText = descText;

    const modulsContainer = document.getElementById('moduls-container');
    modulsContainer.innerHTML = '';
    
    // Els mòduls estan a dins d'un objecte 'data'.
    if (!courseData.moduls.data || courseData.moduls.data.length === 0) {
         modulsContainer.innerHTML = '<p>Aquest curs encara no té mòduls.</p>';
        return;
    }
    
    courseData.moduls.data.forEach(modul => {
        const modulData = modul.attributes;
        const moduleEl = document.createElement('div');
        moduleEl.className = 'module';
        
        let preguntesHTML = '<div class="quiz"><h4>Autoavaluació</h4>';
        // Les preguntes (components) vénen com una llista directa.
        if (modulData.preguntes && modulData.preguntes.length > 0) {
            modulData.preguntes.forEach((pregunta, preguntaIndex) => {
                let opcionsHTML = '<ul class="options">';
                // Les opcions també són components dins de la pregunta.
                pregunta.opcions.forEach((opcio) => {
                    opcionsHTML += `<li data-correct="${opcio.esCorrecta}">${opcio.text}</li>`;
                });
                opcionsHTML += '</ul>';
                preguntesHTML += `
                    <div class="question" id="q-${pregunta.id}-${preguntaIndex}">
                        <p>${preguntaIndex + 1}. ${pregunta.text}</p>
                        ${opcionsHTML}
                        <div class="explanation">${pregunta.explicacio}</div>
                    </div>
                `;
            });
        }
        preguntesHTML += '</div>';

        moduleEl.innerHTML = `<h3>${modulData.titol}</h3><p class="summary">${modulData.resum}</p>${preguntesHTML}`;
        modulsContainer.appendChild(moduleEl);
    });
    
    addQuizInteractivity();
}

// Aquesta funció no canvia, la deixem com estava.
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
                questionDiv.querySelector('li[data-correct="true"]').style.backgroundColor = '#a5d6a7';
            }
            questionDiv.querySelector('.explanation').style.display = 'block';
        });
    });
}