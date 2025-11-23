// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // Solo ejecutar si estamos en la vista de Dashboard (Lista de cursos)
    const dashboardView = document.getElementById('dashboard-view');
    // Si no existe el dashboard o está oculto (estamos en un examen), no hacemos nada
    if (!dashboardView || dashboardView.style.display === 'none') return;

    loadUserCourses();
});

async function loadUserCourses() {
    const coursesList = document.getElementById('courses-list');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) return;

    // Spinner de carga mientras Strapi responde
    coursesList.innerHTML = '<div class="loader"></div>';

    try {
        // Petición a Strapi v5:
        // 1. Filtramos por el ID del usuario logueado.
        // 2. Usamos 'populate' para traernos los datos del curso (título, horas...) y la imagen.
        // ANTIGUA (MALA):
// const query = `filters[user][id][$eq]=${user.id}&populate[curs][populate]=imatge`;

// NUEVA (BUENA):
const query = `filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge`;
        const url = `${API_ROUTES.checkAffiliate.replace('/api/afiliados', '')}/api/matriculas?${query}`; 
        // Nota: Usamos la URL base sacada de config (truco para no reescribir la url base)

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error al cargar cursos');

        const data = await response.json();
        const matriculas = data.data;

        coursesList.innerHTML = ''; // Limpiar loader

        // Caso: Usuario sin cursos
        if (!matriculas || matriculas.length === 0) {
            coursesList.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                    <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No estàs matriculat a cap curs actualment.</p>
                </div>`;
            return;
        }

        // Renderizar Tarjetas
        matriculas.forEach(item => {
            const mat = item; 
            const curso = mat.curs; 
            
            if(!curso) return;

            // Gestión de Imagen (Strapi a veces devuelve array o objeto simple)
            let imgUrl = 'img/logo-sicap.png'; // Imagen por defecto si no hay
            if (curso.imatge && curso.imatge.url) {
                imgUrl = curso.imatge.url; 
            } else if (curso.imatge && curso.imatge[0] && curso.imatge[0].url) {
                imgUrl = curso.imatge[0].url;
            }

            // Calculamos color de barra según progreso (Verde si completo, Azul si no)
            const progressColor = mat.progres >= 100 ? '#10b981' : 'var(--brand-blue)';

            // Crear HTML de la Tarjeta
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
        console.error(error);
        coursesList.innerHTML = '<p style="color:red; text-align:center; width:100%;">Error de connexió carregant els cursos.</p>';
    }
}