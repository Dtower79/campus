// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar la Cabecera Pro (Usuario, Menú, Iniciales)
    initHeader();

    // 2. Si estamos en la vista de Dashboard (Mis cursos), cargar el contenido
    const dashboardView = document.getElementById('dashboard-view');
    if (dashboardView && dashboardView.style.display !== 'none') {
        loadUserCourses();
    }
});

// --- FUNCIÓN 1: GESTIÓN DE LA CABECERA (Header Pro) ---
function initHeader() {
    const userJson = localStorage.getItem('user');
    if (!userJson) return;

    const user = JSON.parse(userJson);

    // A. Poner Iniciales en el círculo (Ej: "RN" o "87" si es DNI)
    const initialsEl = document.getElementById('user-initials');
    const dropdownName = document.getElementById('dropdown-username');
    const dropdownEmail = document.getElementById('dropdown-email');

    // Cálculo de iniciales:
    // Si tiene campos nombre/apellidos en Strapi, los usamos. Si no, usamos las 2 primeras letras del usuario.
    let initials = user.username.substring(0, 2).toUpperCase();
    
    if (user.nombre) {
        // Si existe el campo nombre (y apellidos), cogemos la primera letra de cada uno
        const letter1 = user.nombre.charAt(0);
        const letter2 = user.apellidos ? user.apellidos.charAt(0) : '';
        initials = (letter1 + letter2).toUpperCase();
    }

    // Rellenamos el HTML
    if (initialsEl) initialsEl.innerText = initials;
    if (dropdownName) dropdownName.innerText = user.nombre ? `${user.nombre} ${user.apellidos || ''}` : user.username;
    if (dropdownEmail) dropdownEmail.innerText = user.email;

    // B. Lógica del Menú Desplegable (Abrir/Cerrar)
    const trigger = document.getElementById('user-menu-trigger');
    const menu = document.getElementById('user-dropdown-menu');
    
    if (trigger && menu) {
        // Al hacer clic en el usuario/círculo
        trigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que el clic llegue al document y se cierre al instante
            menu.classList.toggle('show');
        });

        // Cerrar si hacemos clic en cualquier otro sitio de la página
        document.addEventListener('click', () => {
            menu.classList.remove('show');
        });
    }

    // C. Botón "Sortir" dentro del menú desplegable
    const btnLogoutDrop = document.getElementById('btn-logout-dropdown');
    if (btnLogoutDrop) {
        btnLogoutDrop.addEventListener('click', (e) => {
            e.preventDefault();
            // Borrar sesión
            localStorage.removeItem('jwt');
            localStorage.removeItem('user');
            // Recargar página para volver al login
            window.location.href = window.location.pathname; 
        });
    }
}

// --- FUNCIÓN 2: CARGAR CURSOS (Global para llamarla desde F5 o Login) ---
window.loadUserCourses = async function() {
    const coursesList = document.getElementById('courses-list');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));

    // Si no hay token o no existe el contenedor, no hacemos nada
    if (!token || !user || !coursesList) return;

    // Spinner de carga
    coursesList.innerHTML = '<div class="loader"></div>';

    try {
        // Petición a Strapi v5:
        // Filtramos matrículas por ID de usuario y traemos datos del curso + imagen
        const query = `filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge`;
        const url = `${STRAPI_URL}/api/matriculas?${query}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error API');

        const data = await response.json();
        const matriculas = data.data;

        coursesList.innerHTML = ''; // Limpiar loader

        // Caso: No hay cursos
        if (!matriculas || matriculas.length === 0) {
            coursesList.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                    <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No estàs matriculat a cap curs actualment.</p>
                </div>`;
            return;
        }

        // Caso: Hay cursos -> Renderizar tarjetas
        matriculas.forEach(item => {
            const mat = item; 
            const curso = mat.curs; 
            
            if (!curso) return;

            // --- LÓGICA DE IMAGEN ---
            let imgUrl = 'img/logo-sicap.png'; // Fallback
            
            const imgData = curso.imatge;
            if (imgData) {
                // Strapi v5: a veces array, a veces objeto
                const realImg = Array.isArray(imgData) ? imgData[0] : imgData;
                
                if (realImg && realImg.url) {
                    imgUrl = realImg.url;
                    // Fix URL relativa si falta dominio
                    if (imgUrl.startsWith('/')) {
                        imgUrl = `${STRAPI_URL}${imgUrl}`;
                    }
                }
            }

            // Barra de progreso (Verde si 100%, Azul si menos)
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