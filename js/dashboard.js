// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
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
        // INTENTO 3: Usamos 'user' que es el estándar.
        // Si esto falla, es que el permiso en Strapi (Roles -> Authenticated -> Matricula) no está en 'find'.
        const query = `filters[user][id][$eq]=${user.id}&populate[curs][populate]=imatge`;
        
        // Construimos la URL
        // Asegúrate de que API_ROUTES.checkAffiliate está definido en config.js
        // Truco para sacar la base:
        const baseUrl = STRAPI_URL; 
        const url = `${baseUrl}/api/matriculas?${query}`;

        console.log("Pidiendo datos a:", url); // Para ver en consola si la URL está bien

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            // Si falla, mostramos el error técnico en la tarjeta para saber qué pasa
            const errorData = await response.json();
            throw new Error(JSON.stringify(errorData.error));
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

            let imgUrl = 'img/logo-sicap.png'; 
            if (curso.imatge && curso.imatge.url) {
                imgUrl = curso.imatge.url; 
            } else if (curso.imatge && curso.imatge[0] && curso.imatge[0].url) {
                imgUrl = curso.imatge[0].url;
            }

            const progressColor = mat.progres >= 100 ? '#10b981' : 'var(--brand-blue)';

            const card = document.createElement('div');
            card.className = 'course-card-item';
            
            card.innerHTML = `
                <div class="card-image-header" style="background-image: url('${imgUrl}');">
                    ${curso.etiqueta ? `<span class="course-badge">${curso.etiqueta}</span>` : ''}
                </div>
                <div class="card-body">
                    <h3 class="course-title">${curso.titol}</h3>
                    ${curso.hores ? `<div class="course-meta"><i class="fa-regular fa-clock"></i> ${curso.hores}</div>` : ''}
                    
                    <div class="course-desc">
                        ${curso.descripcio ? curso.descripcio.substring(0, 90) + '...' : 'Sense descripció.'}
                    </div>

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
        // Esto imprimirá el error exacto en la pantalla roja
        coursesList.innerHTML = `<p style="color:red; word-break:break-all;">Error: ${error.message}</p>`;
    }
}