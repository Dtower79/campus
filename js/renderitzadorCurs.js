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

    // --- LÍNIA DE DEPURACIÓ ---
    const fetchUrl = `/.netlify/functions/dadesCurs?slug=${courseSlug}`;
    console.log("Intentant carregar dades des de:", fetchUrl); 
    // -------------------------

    fetch(fetchUrl)
        .then(res => {
            if (!res.ok) {
                console.error("Detalls de la resposta amb error:", res);
                throw new Error(`El servidor ha retornat un error ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            renderCourse(data);
        })
        .catch(error => {
            console.error("Error al carregar les dades del curs:", error);
            document.getElementById('container').innerHTML = `<h1>Error al carregar el curs. Revisa la consola per a més detalls.</h1>`;
        });
});

// La resta del fitxer (les funcions renderCourse i addQuizInteractivity) es queda exactament igual.
function renderCourse(courseData) {
    document.title = courseData.titol;
    document.getElementById('curs-titol').innerText = courseData.titol;
    document.getElementById('curs-descripcio').innerText = courseData.descripcio;
    const modulsContainer = document.getElementById('moduls-container');
    modulsContainer.innerHTML = ''; 
    if (!courseData.moduls || courseData.moduls.length === 0) {
        modulsContainer.innerHTML = '<p>Aquest curs encara no té mòduls.</p>';
        return;
    }
    courseData.moduls.forEach(modul => {
        const moduleEl = document.createElement('div');
        moduleEl.className = 'module';
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
                questionDiv.querySelector('li[data-correct="true"]').style.backgroundColor = '#a5d6a7';
            }
            questionDiv.querySelector('.explanation').style.display = 'block';
        });
    });
}