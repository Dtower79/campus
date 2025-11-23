// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // Solo ejecutar si estamos en la vista de Dashboard
    const dashboardView = document.getElementById('dashboard-view');
    if (!dashboardView || dashboardView.style.display === 'none') return;

    loadUserCourses();
});

async function loadUserCourses() {
    const coursesList = document.getElementById('courses-list');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) return;

    coursesList.innerHTML = '<div class="loader"></div>';

    try {
        // AHORA SÍ: Usamos el nombre real del campo que vimos en tu captura de Admin.
        // Al haber activado los permisos en el PASO 1, esto dejará de dar error.
        const query = `filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge`;
        
        const url = `${STRAPI_URL}/api/matriculas?${query}`;

        console.log("Pidiendo cursos a:", url);

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(JSON.stringify(err));
        }

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

        // RENDERIZADO
        matriculas.forEach(item => {
            const mat = item; 
            const curso = mat.curs; 
            
            if(!curso) return;

            // Gestión de Imagen
            let imgUrl = 'img/logo-sicap.png'; 
            if (curso.imatge && curso.imatge.url) {
                imgUrl = curso.imatge.url; 
            } else if (curso.imatge && curso.imatge[0] && curso.imatge[0].url) {
                imgUrl = curso.imatge[0].url;
            }

            // Barra de progreso
            const progressColor = mat.progres >= 100 ? '#10b981' : 'var(--brand-blue)';

            const card = document.createElement('div');
            card.className = 'course-card-item';
            
            // Descripción cortada si es muy larga
            let desc = 'Sense descripció.';
            if (curso.descripcio) {
                // Si es texto rico (array), lo ignoramos en la tarjeta para no romper el diseño, o ponemos un texto genérico
                if(Array.isArray(curso.descripcio)) {
                     desc = "Fes clic per veure els detalls del curs.";
                } else {
                     desc = curso.descripcio.substring(0, 90) + '...';
                }
            }

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
        coursesList.innerHTML = `<p style="color:red; text-align:center;">Error carregant cursos. Revisa els permisos en Strapi.</p>`;
    }
}