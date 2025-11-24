document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('jwt') && !window.appIniciada) {
        window.iniciarApp();
    }
});

window.logoutApp = function() {
    console.log("👋 Cerrando sesión y limpiando datos...");
    localStorage.clear();
    window.location.href = 'index.html';
};

window.appIniciada = false;

window.iniciarApp = function() {
    if (window.appIniciada) return;
    window.appIniciada = true;

    console.log("🚀 Iniciando SICAP App (Final v2)...");

    // 1. Eventos Globales
    initGlobalEvents();

    // 2. Cargar Header
    try { initHeaderData(); } catch (e) { console.error("Header Error:", e); }

    // 3. Router Inicial
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('slug')) {
        window.showView('dashboard');
    } else {
        const dash = document.getElementById('dashboard-view');
        const exam = document.getElementById('exam-view');
        if(dash) dash.style.display = 'none';
        if(exam) exam.style.display = 'flex';
    }
};

/**
 * LÓGICA CENTRAL DE EVENTOS
 */
function initGlobalEvents() {
    const navMenu = document.getElementById('main-nav');
    const userDropdown = document.getElementById('user-dropdown-menu');

    document.addEventListener('click', (e) => {
        
        // A. HAMBURGUESA (Móvil)
        const btnMobile = e.target.closest('#mobile-menu-btn');
        if (btnMobile) {
            navMenu.classList.toggle('show-mobile');
            return;
        }

        // B. BOTÓN USUARIO (RN)
        const btnUser = e.target.closest('#user-menu-trigger');
        if (btnUser) {
            userDropdown.classList.toggle('show');
            userDropdown.style.display = userDropdown.classList.contains('show') ? 'flex' : 'none';
            return;
        }

        // C. GESTIÓN DE CLICS DENTRO DEL DESPLEGABLE (PERFIL / NOTAS / SALIR)
        const dropLink = e.target.closest('#user-dropdown-menu a');
        if (dropLink) {
            e.preventDefault(); // Detenemos comportamiento por defecto

            const action = dropLink.getAttribute('data-action');
            const isLogout = dropLink.id === 'btn-logout-dropdown' || dropLink.innerHTML.includes('Sortir');

            // Caso 1: Navegación (Perfil / Notas)
            if (action) {
                console.log("👉 Ir a:", action);
                window.showView(action);
            } 
            // Caso 2: Logout (Detectado por ID o Texto)
            else if (isLogout) {
                window.logoutApp();
            }

            // Cerrar menú tras la acción
            userDropdown.classList.remove('show');
            userDropdown.style.display = 'none';
            return;
        }

        // D. NAVEGACIÓN PRINCIPAL
        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            e.preventDefault();
            const map = {
                'nav-catalog': 'home',
                'nav-profile': 'profile',
                'nav-dashboard': 'dashboard'
            };
            const view = map[navLink.id];
            if (view) {
                window.showView(view);
                if(navMenu) navMenu.classList.remove('show-mobile');
            }
        }

        // E. CERRAR AL CLICAR FUERA
        if (!e.target.closest('#user-menu-trigger') && !e.target.closest('#user-dropdown-menu')) {
            if(userDropdown) {
                userDropdown.classList.remove('show');
                userDropdown.style.display = 'none';
            }
        }
        if (!e.target.closest('#main-nav') && !e.target.closest('#mobile-menu-btn')) {
            if(navMenu) navMenu.classList.remove('show-mobile');
        }
    });
}

function initHeaderData() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const setText = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };
    
    let initials = user.nombre ? user.nombre.charAt(0) : user.username.substring(0, 1);
    if (user.apellidos) initials += user.apellidos.charAt(0);
    else if (user.username.length > 1) initials += user.username.charAt(1);
    initials = initials.toUpperCase();

    setText('user-initials', initials);
    setText('dropdown-username', user.nombre ? `${user.nombre} ${user.apellidos}` : user.username);
    setText('dropdown-email', user.email);
    setText('profile-avatar-big', initials);
    setText('profile-name-display', user.nombre ? `${user.nombre} ${user.apellidos}` : user.username);
    setText('profile-dni-display', user.username);
}

window.showView = function(viewName) {
    const views = {
        home: document.getElementById('catalog-view'),
        dashboard: document.getElementById('dashboard-view'),
        profile: document.getElementById('profile-view'),
        grades: document.getElementById('grades-view'),
        exam: document.getElementById('exam-view')
    };

    Object.values(views).forEach(el => { if(el) el.style.display = 'none'; });
    
    if(views[viewName]) {
        views[viewName].style.display = viewName === 'exam' ? 'flex' : 'block';
    }
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeMap = { 'home': 'nav-catalog', 'profile': 'nav-profile', 'dashboard': 'nav-dashboard' };
    if (activeMap[viewName]) {
        const btn = document.getElementById(activeMap[viewName]);
        if(btn) btn.classList.add('active');
    }

    if(viewName === 'dashboard') loadUserCourses();
    if(viewName === 'home') loadCatalog();
    if(viewName === 'profile') loadFullProfile();
    if(viewName === 'grades') loadGrades();
};

async function loadUserCourses() {
    const list = document.getElementById('courses-list');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));
    if(!list || !token) return;
    list.innerHTML = '<div class="loader"></div>';
    try {
        const query = `filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge`;
        const res = await fetch(`${STRAPI_URL}/api/matriculas?${query}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        list.innerHTML = '';
        if(!json.data || json.data.length === 0) { list.innerHTML = '<p style="text-align:center; padding:20px;">No tens cursos actius.</p>'; return; }
        json.data.forEach(mat => {
            const curs = mat.curs; if(!curs) return;
            let imgUrl = 'img/logo-sicap.png';
            if(curs.imatge) { const img = Array.isArray(curs.imatge) ? curs.imatge[0] : curs.imatge; if(img?.url) imgUrl = img.url.startsWith('/') ? STRAPI_URL + img.url : img.url; }
            const color = mat.progres >= 100 ? '#10b981' : 'var(--brand-blue)';
            list.innerHTML += `<div class="course-card-item"><div class="card-image-header" style="background-image: url('${imgUrl}');">${curs.etiqueta ? `<span class="course-badge">${curs.etiqueta}</span>` : ''}</div><div class="card-body"><h3 class="course-title">${curs.titol}</h3><div class="course-meta">${curs.hores || ''}</div><div class="progress-container"><div class="progress-bar"><div class="progress-fill" style="width:${mat.progres||0}%; background:${color}"></div></div><span class="progress-text">${mat.progres||0}% Completat</span></div><a href="index.html?slug=${curs.slug}" class="btn-primary" style="margin-top:auto; text-align:center;">Accedir</a></div></div>`;
        });
    } catch(e) { list.innerHTML = '<p style="color:red;">Error.</p>'; }
}

async function loadFullProfile() {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    const emailIn = document.getElementById('prof-email');
    if(emailIn) emailIn.value = user.email;
    try {
        const res = await fetch(`${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${user.username}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        if(json.data && json.data.length > 0) {
            const afi = json.data[0];
            const map = {'prof-movil': afi.TelefonoMobil, 'prof-prov': afi.Provincia, 'prof-pob': afi.Poblacion, 'prof-centre': afi.CentroTrabajo, 'prof-cat': afi.CategoriaProfesional, 'prof-dir': afi.Direccion, 'prof-iban': afi.IBAN};
            for (const [id, val] of Object.entries(map)) { const el = document.getElementById(id); if(el) el.value = val || '-'; }
        }
    } catch(e) {}
}
async function loadCatalog() { document.getElementById('catalog-list').innerHTML = '<p style="text-align:center; padding:20px;">No hi ha nous cursos.</p>'; }
async function loadGrades() { document.getElementById('grades-table-body').innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Sense dades.</td></tr>'; }