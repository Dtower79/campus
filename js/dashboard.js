// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initNavigation();
    loadNotifications(); // Cargar notificaciones al inicio

    const dashboardView = document.getElementById('dashboard-view');
    if (dashboardView && dashboardView.style.display !== 'none') {
        loadUserCourses();
    }
});

// --- 1. GESTIÓN DE CABECERA Y DATOS USUARIO ---
function initHeader() {
    const userJson = localStorage.getItem('user');
    if (!userJson) return;

    const user = JSON.parse(userJson);
    const initialsEl = document.getElementById('user-initials');
    const dropdownName = document.getElementById('dropdown-username');
    const dropdownEmail = document.getElementById('dropdown-email');
    
    // Calcular iniciales
    let initials = user.username.substring(0, 2).toUpperCase();
    if (user.nombre) {
        const letter1 = user.nombre.charAt(0);
        const letter2 = user.apellidos ? user.apellidos.charAt(0) : '';
        initials = (letter1 + letter2).toUpperCase();
    }

    // Actualizar Cabecera
    if (initialsEl) initialsEl.innerText = initials;
    if (dropdownName) dropdownName.innerText = user.nombre ? `${user.nombre} ${user.apellidos || ''}` : user.username;
    if (dropdownEmail) dropdownEmail.innerText = user.email;

    // Actualizar Vista Perfil (si existe)
    const profileBig = document.getElementById('profile-avatar-big');
    const profileName = document.getElementById('profile-name');
    const profileDni = document.getElementById('profile-dni');
    const profileEmail = document.getElementById('profile-email');

    if(profileBig) profileBig.innerText = initials;
    if(profileName) profileName.innerText = user.nombre ? `${user.nombre} ${user.apellidos || ''}` : user.username;
    if(profileDni) profileDni.value = user.username;
    if(profileEmail) profileEmail.value = user.email;

    // Eventos Dropdown
    const trigger = document.getElementById('user-menu-trigger');
    const menu = document.getElementById('user-dropdown-menu');
    
    if (trigger && menu) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
        });
        document.addEventListener('click', () => menu.classList.remove('show'));
    }

    // Logout
    const btnLogoutDrop = document.getElementById('btn-logout-dropdown');
    if (btnLogoutDrop) {
        btnLogoutDrop.addEventListener('click', handleLogout);
    }
}

function handleLogout(e) {
    if(e) e.preventDefault();
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    window.location.href = window.location.pathname;
}

// --- 2. NAVEGACIÓN (ROUTER SIMPLE) ---
function initNavigation() {
    const views = {
        home: document.getElementById('dashboard-view'),
        profile: document.getElementById('profile-view'),
        grades: document.getElementById('grades-view'),
        exam: document.getElementById('exam-view') // Ya existente
    };

    function showView(viewName) {
        // Ocultar todas
        Object.values(views).forEach(el => { if(el) el.style.display = 'none'; });
        // Mostrar la elegida
        if(views[viewName]) {
            views[viewName].style.display = viewName === 'exam' ? 'flex' : 'block';
        }
        // Cerrar dropdown si está abierto
        const menu = document.getElementById('user-dropdown-menu');
        if(menu) menu.classList.remove('show');
    }

    // Enlaces del Menú Dropdown
    document.querySelector('a[href="#"][onclick*="Profile"]')?.addEventListener('click', (e) => { e.preventDefault(); showView('profile'); }); // Si usas onclick inline
    
    // Mapeo manual de los enlaces del dropdown
    const links = document.querySelectorAll('.user-dropdown ul li a');
    if(links.length > 0) {
        links[0].addEventListener('click', (e) => { e.preventDefault(); showView('profile'); }); // Perfil
        links[1].addEventListener('click', (e) => { e.preventDefault(); showView('grades'); loadGrades(); }); // Calificaciones
        links[2].addEventListener('click', (e) => { e.preventDefault(); alert('Preferències: En desenvolupament.'); }); // Preferencias
    }

    // Enlaces Cabecera (Nav Principal)
    const navLinks = document.querySelectorAll('.header-nav .nav-link');
    if(navLinks.length > 0) {
        navLinks[0].addEventListener('click', (e) => { e.preventDefault(); showView('home'); }); // Pagina Principal
        navLinks[1].addEventListener('click', (e) => { e.preventDefault(); showView('profile'); }); // Area personal
        navLinks[2].addEventListener('click', (e) => { e.preventDefault(); showView('home'); }); // Mis cursos
    }
}

// --- 3. CARGAR CURSOS ---
window.loadUserCourses = async function() {
    const coursesList = document.getElementById('courses-list');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user || !coursesList) return;
    coursesList.innerHTML = '<div class="loader"></div>';

    try {
        const query = `filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge`;
        const url = `${STRAPI_URL}/api/matriculas?${query}`;
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        const matriculas = data.data;

        coursesList.innerHTML = ''; 
        if (!matriculas || matriculas.length === 0) {
            coursesList.innerHTML = `<p style="text-align:center; padding:20px;">No estàs matriculat a cap curs.</p>`;
            return;
        }

        matriculas.forEach(item => {
            const mat = item; const curso = mat.curs; if (!curso) return;
            
            let imgUrl = 'img/logo-sicap.png';
            if (curso.imatge && (curso.imatge.url || (curso.imatge[0] && curso.imatge[0].url))) {
                imgUrl = curso.imatge.url || curso.imatge[0].url;
                if (imgUrl.startsWith('/')) imgUrl = `${STRAPI_URL}${imgUrl}`;
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
                    <div class="course-desc">${curso.descripcio ? (Array.isArray(curso.descripcio) ? 'Veure detalls.' : curso.descripcio.substring(0,90)+'...') : '...'}</div>
                    <div class="progress-container">
                        <div class="progress-bar"><div class="progress-fill" style="width: ${mat.progres || 0}%; background-color: ${progressColor}"></div></div>
                        <span class="progress-text">${mat.progres || 0}% Completat</span>
                    </div>
                    <a href="index.html?slug=${curso.slug}" class="btn-primary" style="margin-top:auto; width:100%; text-align:center;">Accedir al Curs</a>
                </div>
            `;
            coursesList.appendChild(card);
        });
    } catch (error) { console.error(error); coursesList.innerHTML = '<p>Error carregant cursos.</p>'; }
};

// --- 4. CARGAR NOTIFICACIONES (Campana) ---
async function loadNotifications() {
    // Aquí implementaremos la lógica de la campana en el siguiente paso si quieres
    // De momento, solo visual:
    const dot = document.querySelector('.notification-dot');
    if(dot) dot.style.display = 'none'; // Ocultar si no hay (mock)
}

// --- 5. CARGAR CALIFICACIONES ---
async function loadGrades() {
    const tbody = document.getElementById('grades-table-body');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if(!tbody || !token) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregant...</td></tr>';

    try {
        const query = `filters[users_permissions_user][id][$eq]=${user.id}&populate=curs`;
        const url = `${STRAPI_URL}/api/matriculas?${query}`;
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        
        tbody.innerHTML = '';
        data.data.forEach(mat => {
            const nota = mat.nota_final !== null ? mat.nota_final : '-';
            const row = `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${mat.curs.titol}</td>
                    <td style="padding: 10px;">${mat.estat}</td>
                    <td style="padding: 10px; font-weight:bold;">${nota}</td>
                    <td style="padding: 10px;">${nota >= 5 ? '<a href="#" style="color:var(--brand-blue)">Descarregar</a>' : '<span style="color:#999">No disponible</span>'}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch(e) { console.error(e); tbody.innerHTML = '<tr><td colspan="4">Error.</td></tr>'; }
}