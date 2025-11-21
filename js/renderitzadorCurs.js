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
    
    // Cridem a la funció de backend
    fetch(`/.netlify/functions/dadesCurs?slug=${courseSlug}`)
        .then(res => {
            if (!res.ok) throw new Error("Error de xarxa");
            return res.json();
        })
        .then(data => {
            // CORRECCIÓ 1:
            // El backend ja ens envia les dades netes (sense 'attributes').
            // Passem 'data' directament.
            if (data.error) {
                throw new Error(data.error);
            }
            renderCourse(data); 
        })
        .catch(error => {
            console.error("Error en carregar les dades del curs:", error);
            document.getElementById('container').innerHTML = `<h1>Error al carregar el curs.</h1><p>${error.message}</p>`;
        });
});

function renderCourse(courseData) {
    // CORRECCIÓ 2: Accedim directament a les propietats (ja són planes)
    document.title = courseData.titol;
    document.getElementById('curs-titol').innerText = courseData.titol;
    
    // CORRECCIÓ 3: Gestió de la descripció
    // Si Strapi l'envia com a text simple (el més probable ara), el pintem directe.
    // Si fos Rich Text antic, mantindríem la lògica complexa. Farem un "fallback".
    let descText = '';
    if (typeof courseData.descripcio === 'string') {
        descText = courseData.descripcio;
    } else if (Array.isArray(courseData.descripcio) && courseData.descripcio[0]?.children) {
        descText = courseData.descripcio[0].children[0].text;
    }
    document.getElementById('curs-descripcio').innerText = descText;

    const modulsContainer = document.getElementById('moduls-container');
    modulsContainer.innerHTML = '';
    
    // CORRECCIÓ 4: Els mòduls ara són un Array directe (sense .data)
    if (!courseData.moduls || courseData.moduls.length === 0) {
         modulsContainer.innerHTML = '<p>Aquest curs encara no té mòduls.</p>';
        return;
    }
    
    courseData.moduls.forEach(modul => {
        // CORRECCIÓ 5: El mòdul ja ve net (sense .attributes)
        const modulData = modul; 
        
        const moduleEl = document.createElement('div');
        moduleEl.className = 'module';
        
        let preguntesHTML = '<div class="quiz"><h4>Autoavaluació</h4>';
        
        // Les preguntes ja venen netes gràcies al backend
        if (modulData.preguntes && modulData.preguntes.length > 0) {
            modulData.preguntes.forEach((pregunta, preguntaIndex) => {
                let opcionsHTML = '<ul class="options">';
                
                // Les opcions venen dins de la pregunta
                if (pregunta.opcions && Array.isArray(pregunta.opcions)) {
                    pregunta.opcions.forEach((opcio) => {
                        opcionsHTML += `<li data-correct="${opcio.esCorrecta}">${opcio.text}</li>`;
                    });
                }
                opcionsHTML += '</ul>';
                
                preguntesHTML += `
                    <div class="question" id="q-${pregunta.id}-${preguntaIndex}">
                        <p>${preguntaIndex + 1}. ${pregunta.text}</p>
                        ${opcionsHTML}
                        <div class="explanation" style="display:none;">${pregunta.explicacio}</div>
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
                
                // Marcar la correcta en verd claret per ensenyar la solució
                const correctOption = questionDiv.querySelector('li[data-correct="true"]');
                if(correctOption) correctOption.style.backgroundColor = '#a5d6a7';
            }
            
            // Mostrar explicació
            const explicacio = questionDiv.querySelector('.explanation');
            if (explicacio) explicacio.style.display = 'block';
        });
    });
}