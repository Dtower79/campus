document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('jwt') && !window.appIniciada) {
        window.iniciarApp();
    }
});

window.logoutApp = function() {
    localStorage.clear();
    window.location.href = 'index.html';
};

window.appIniciada = false;

window.iniciarApp = function() {
    if (window.appIniciada) return;
    window.appIniciada = true;

    console.log("🚀 Iniciando SICAP App v2.0 (Mobile Ready)...");

    // 1. Inicializar Global Events (Click delegado para Menús y Hamburguesa)
    initGlobalEvents();

    // 2. Cargar datos visuales
    try {
        initHeaderData();
    } catch (e) { console.error("Header data error:", e); }

    // 3. Router
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('slug')) {
        window.showView('dashboard');
    } else {
        const dashView = document.getElementById('dashboard-view');
        const examView = document.getElementById('exam-view');
        if(dashView) dashView.style.display = 'none';
        if(examView) examView.style.display = 'flex';
    }
};

/**
 * LÓGICA CENTRALIZADA DE CLICS (SOLUCIÓN DEFINITIVA MENÚS)
 * En lugar de asignar onclicks individuales que fallan, escuchamos a todo el documento.
 */
function initGlobalEvents() {
    const navMenu = document.getElementById('main-nav');
    const userDropdown = document.getElementById('user-dropdown-menu');

    document.addEventListener('click', (e) => {
        // A. LOGICA BOTÓN HAMBURGUESA
        const btnMobile = e.target.closest('#mobile-menu-btn');
        if (btnMobile) {
            navMenu.classList.toggle('show-mobile');
            return; // Stop processing
        }

        // B. LOGICA BOTÓN USUARIO (RN)
        const btnUser = e.target.closest('#user-menu-trigger');
        if (btnUser) {
            userDropdown.classList.toggle('show');
            // Forzar display block si CSS falla
            userDropdown.style.display = userDropdown.classList.contains('show') ? 'block' : 'none';
            return;
        }

        // C. LOGICA PARA CERRAR MENÚS AL HACER CLICK FUERA
        // Si click fuera del dropdown usuario -> cerrar
        if (!e.target.closest('#user-dropdown-menu') && !e.target.closest('#user-menu-trigger')) {
            if (userDropdown) {
                userDropdown.classList.remove('show');
                userDropdown.style.display = 'none';
            }
        }
        
        // Si click fuera del menú móvil -> cerrar (opcional, mejor UX)
        if (!e.target.closest('#main-nav') && !e.target.closest('#mobile-menu-btn')) {
            if (navMenu && navMenu.classList.contains('show-mobile')) {
                navMenu.classList.remove('show-mobile');
            }
        }

        // D. NAVEGACIÓN (Links del menú principal)
        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            e.preventDefault();
            // Mapeo ID -> Vista
            const map = {
                'nav-catalog': 'home',
                'nav-profile': 'profile',
                'nav-dashboard': 'dashboard'
            };
            const view = map[navLink.id];
            if (view) {
                window.showView(view);
                // Cerrar menú móvil si estaba abierto
                if(navMenu) navMenu.classList.remove('show-mobile');
            }
        }

        // E. NAVEGACIÓN (Links del dropdown usuario)
        const dropLink = e.target.closest('a[data-action]');
        if (dropLink) {
            e.preventDefault();
            const action = dropLink.getAttribute('data-action');
            if (action === 'profile') window.showView('profile');
            if (action === 'grades') window.showView('grades');
            // Cerrar dropdown
            userDropdown.classList.remove('show');
            userDropdown.style.display = 'none';
        }
    });
}

function initHeaderData() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    // Textos
    const setText = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };
    
    let initials = user.nombre ? user.nombre.charAt(0) + (user.apellidos ? user.apellidos.charAt(0) : '') : user.username.substring(0, 2);
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

    // Ocultar todas
    Object.values(views).forEach(el => { if(el) el.style.display = 'none'; });
    
    // Mostrar actual
    if(views[viewName]) views[viewName].style.display = viewName === 'exam' ? 'flex' : 'block';
    
    // Actualizar clases Active
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeMap = { 'home': 'nav-catalog', 'profile': 'nav-profile', 'dashboard': 'nav-dashboard' };
    if (activeMap[viewName]) document.getElementById(activeMap[viewName])?.classList.add('active');

    // Cargar datos
    if(viewName === 'dashboard') loadUserCourses();
    if(viewName === 'home') loadCatalog();
    if(viewName === 'profile') loadFullProfile();
    if(viewName === 'grades') loadGrades();
};

// --- CARGADORES DE DATOS (IGUAL QUE ANTES) ---
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
async function loadFullProfile() { /* ... MISMA LOGICA ... */
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    document.getElementById('prof-email').value = user.email;
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