// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // Si ya estamos dentro (recarga de página), cargamos.
    const dashboardView = document.getElementById('dashboard-view');
    if (dashboardView && dashboardView.style.display !== 'none') {
        loadUserCourses();
    }
});

// Hacemos la función GLOBAL para que auth.js pueda llamarla al hacer Login
window.loadUserCourses = async function() {
    const coursesList = document.getElementById('courses-list');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));

    // Si no hay token o no existe el contenedor, no hacemos nada
    if (!token || !user || !coursesList) return;

    coursesList.innerHTML = '<div class="loader"></div>';

    try {
        const query = `filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge`;
        const url = `${STRAPI_URL}/api/matriculas?${query}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error API');

        const data = await response.json();
        const matriculas = data.data;

        coursesList.innerHTML = ''; 

        if (!matriculas || matriculas.length === 0) {
            coursesList.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                    <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No estàs matriculat a cap curs actualment.</p>
                </div>`;
            return;
        }

        matriculas.forEach(item => {
            const mat = item; 
            const curso = mat.curs; 
            
            if (!curso) return;

            // --- LÓGICA DE IMAGEN MEJORADA ---
            let imgUrl = 'img/logo-sicap.png'; // Imagen por defecto
            
            // Intentamos sacar la imagen de Strapi
            const imgData = curso.imatge;
            if (imgData) {
                // Strapi v5 a veces devuelve array si es múltiple, o objeto si es single
                const realImg = Array.isArray(imgData) ? imgData[0] : imgData;
                
                if (realImg && realImg.url) {
                    imgUrl = realImg.url;
                    // IMPORTANTE: Si la URL empieza por '/', le falta el dominio. Se lo ponemos.
                    if (imgUrl.startsWith('/')) {
                        imgUrl = `${STRAPI_URL}${imgUrl}`;
                    }
                }
            }

            // Barra de progreso
            const progressColor = mat.progres >= 100 ? '#10b981' : 'var(--brand-blue)';

            // Descripción corta
            let desc = 'Sense descripció.';
            if (curso.descripcio) {
                if(Array.isArray(curso.descripcio)) {
                     desc = "Fes clic per veure els detalls del curs.";
                } else {
                     desc = curso.descripcio.substring(0, 90) + '...';
                }
            }

            const card = document.createElement('div');
            card.className = 'course-card-item';
            
            card.innerHTML = `
                <div class="card-image-header" style="background-image: url('${imgUrl}');">
                    ${curso.etiqueta ? `<span class="course-badge">${curso.etiqueta}</span>` : ''}
                </div>
                <div class="card-body">
                    <h3 class="course-title">${curso.titol}</h3>
                    ${curso.hores ? `<div class="course-meta"><i class="fa-regular fa-clock"></i> ${curso.hores}</div>` : ''}
                    
                    <div class="course-desc">${desc}</div>

                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${mat.progres || 0}%; background-color: ${progressColor}"></div>
                        </div>
                        <span class="progress-text">${mat.progres || 0}% Completat</span>
                    </div>

                    <a href="index.html?slug=${curso.slug}" class="btn-primary" style="margin-top:auto; width:100%; text-align:center;">
                        Accedir al Curs
                    </a>
                </div>
            `;
            coursesList.appendChild(card);
        });

    } catch (error) {
        console.error("ERROR:", error);
        coursesList.innerHTML = `<p style="color:red; text-align:center;">Error carregant cursos.</p>`;
    }
};