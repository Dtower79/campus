// js/dashboard.js

// Al cargar la página (F5)
document.addEventListener('DOMContentLoaded', () => {
    // Si hay token, iniciamos. Si no, auth.js se encarga de mostrar login.
    if (localStorage.getItem('jwt')) {
        window.iniciarApp();
    }
});

// --- FUNCIÓN MAESTRA DE INICIO ---
window.iniciarApp = function() {
    console.log("🚀 Iniciando App SICAP...");
    
    // 1. Inicializar Cabecera (Nombre, Iniciales)
    initHeader();
    
    // 2. Inicializar Navegación (Router)
    initNavigation();
    
    // 3. Por defecto, vamos a 'Mis Cursos' (Dashboard)
    // O puedes cambiarlo a 'home' si prefieres ir al Catálogo
    const currentView = document.getElementById('dashboard-view').style.display !== 'none' ? 'dashboard' : 'home';
    if(currentView === 'dashboard') loadUserCourses();
};

function initHeader() {
    const userJson = localStorage.getItem('user');
    if (!userJson) return;
    const user = JSON.parse(userJson);

    // Iniciales y Nombre
    let initials = user.username.substring(0, 2).toUpperCase();
    if (user.nombre) {
        initials = (user.nombre.charAt(0) + (user.apellidos ? user.apellidos.charAt(0) : '')).toUpperCase();
    }
    
    // Elementos DOM
    const els = {
        initials: document.getElementById('user-initials'),
        dropName: document.getElementById('dropdown-username'),
        dropEmail: document.getElementById('dropdown-email')
    };
    
    if (els.initials) els.initials.innerText = initials;
    if (els.dropName) els.dropName.innerText = user.nombre ? `${user.nombre} ${user.apellidos}` : user.username;
    if (els.dropEmail) els.dropEmail.innerText = user.email;

    // Dropdown Logic
    const trigger = document.getElementById('user-menu-trigger');
    const menu = document.getElementById('user-dropdown-menu');
    if (trigger && menu) {
        // Clonamos nodo para eliminar listeners antiguos acumulados
        const newTrigger = trigger.cloneNode(true);
        trigger.parentNode.replaceChild(newTrigger, trigger);
        
        newTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
        });
        document.addEventListener('click', () => menu.classList.remove('show'));
    }

    // Logout
    const btnLogout = document.getElementById('btn-logout-dropdown');
    if (btnLogout) {
        btnLogout.onclick = (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = window.location.pathname;
        };
    }
}

function initNavigation() {
    const views = {
        home: document.getElementById('catalog-view'),      // Pàgina Principal (Catálogo)
        dashboard: document.getElementById('dashboard-view'), // Els meus cursos
        profile: document.getElementById('profile-view'),     // Àrea personal (Perfil)
        grades: document.getElementById('grades-view'),
        exam: document.getElementById('exam-view')
    };

    window.showView = function(viewName) {
        Object.values(views).forEach(el => { if(el) el.style.display = 'none'; });
        if(views[viewName]) views[viewName].style.display = viewName === 'exam' ? 'flex' : 'block';
        
        // Cargas lazy
        if(viewName === 'dashboard') loadUserCourses();
        if(viewName === 'profile') loadFullProfile();
        if(viewName === 'home') loadCatalog();
        if(viewName === 'grades') loadGrades();
    };

    // Asignar eventos a los enlaces de navegación (Header)
    const navLinks = document.querySelectorAll('.header-nav .nav-link');
    if(navLinks.length >= 3) {
        navLinks[0].onclick = (e) => { e.preventDefault(); showView('home'); }; // Principal -> Catálogo
        navLinks[1].onclick = (e) => { e.preventDefault(); showView('profile'); }; // Área -> Perfil
        navLinks[2].onclick = (e) => { e.preventDefault(); showView('dashboard'); }; // Mis Cursos -> Dashboard
    }
    
    // Dropdown Links
    const dropLinks = document.querySelectorAll('.user-dropdown ul li a');
    if(dropLinks.length > 0) {
        dropLinks[0].onclick = (e) => { e.preventDefault(); showView('profile'); };
        dropLinks[1].onclick = (e) => { e.preventDefault(); showView('grades'); };
    }
}

// --- CARGAR DATOS DE AFILIADO (PERFIL COMPLETO) ---
async function loadFullProfile() {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    
    // Rellenamos lo básico del User mientras carga el resto
    document.getElementById('profile-name-display').innerText = user.nombre ? `${user.nombre} ${user.apellidos}` : user.username;
    document.getElementById('profile-dni-display').innerText = user.username;
    document.getElementById('profile-avatar-big').innerText = document.getElementById('user-initials').innerText;

    try {
        // Buscamos en la colección 'afiliados' usando el DNI (que es el username)
        const url = `${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${user.username}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }});
        const json = await res.json();
        
        if (json.data && json.data.length > 0) {
            const afi = json.data[0]; // Datos del afiliado
            
            // Rellenar campos
            const fields = {
                'prof-movil': afi.TelefonoMobil || afi.TelefonoFijo || '-',
                'prof-email': afi.email,
                'prof-prov': afi.Provincia,
                'prof-pob': afi.Poblacion,
                'prof-centre': afi.CentroTrabajo,
                'prof-cat': afi.CategoriaProfesional,
                'prof-dir': afi.Direccion,
                'prof-iban': afi.IBAN
            };

            for (const [id, val] of Object.entries(fields)) {
                const el = document.getElementById(id);
                if(el) el.value = val || '';
            }
        }
    } catch (e) {
        console.error("Error cargando perfil afiliado", e);
    }
}

// --- CARGAR CATÁLOGO (TODOS LOS CURSOS) ---
async function loadCatalog() {
    const container = document.getElementById('catalog-list');
    const token = localStorage.getItem('jwt');
    container.innerHTML = '<div class="loader"></div>';

    try {
        const url = `${STRAPI_URL}/api/curs?populate=imatge`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }});
        const json = await res.json();
        
        container.innerHTML = '';
        if(!json.data) return;

        json.data.forEach(curs => {
            let imgUrl = 'img/logo-sicap.png';
            if(curs.imatge?.url) imgUrl = curs.imatge.url.startsWith('/') ? STRAPI_URL + curs.imatge.url : curs.imatge.url;

            const card = document.createElement('div');
            card.className = 'course-card-item';
            card.innerHTML = `
                <div class="card-image-header" style="background-image: url('${imgUrl}');">
                    <span class="course-badge" style="background:#444">Catàleg</span>
                </div>
                <div class="card-body">
                    <h3 class="course-title">${curs.titol}</h3>
                    <div class="course-meta">${curs.hores || ''}</div>
                    <div class="course-desc">${curs.descripcio ? (Array.isArray(curs.descripcio)?'Info detallada disponible.':curs.descripcio.substring(0,80)+'...') : ''}</div>
                    
                    <button class="btn-primary" onclick="alert('Per inscriure\\'t, contacta amb el teu delegat o envia un correu a formacio@sicap.cat')" style="margin-top:auto;">
                        Inscriure's
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch(e) { console.error(e); container.innerHTML = '<p>Error catàleg.</p>'; }
}

// --- TUS CURSOS (YA HECHO) ---
window.loadUserCourses = async function() {
    const list = document.getElementById('courses-list');
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    if(!list) return;
    
    list.innerHTML = '<div class="loader"></div>';

    try {
        const url = `${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }});
        const json = await res.json();
        
        list.innerHTML = '';
        if(!json.data || json.data.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding:20px;">No tens cursos actius.</p>';
            return;
        }

        json.data.forEach(mat => {
            const curs = mat.curs; if(!curs) return;
            let imgUrl = 'img/logo-sicap.png';
            if(curs.imatge?.url) imgUrl = curs.imatge.url.startsWith('/') ? STRAPI_URL + curs.imatge.url : curs.imatge.url;

            const card = document.createElement('div');
            card.className = 'course-card-item';
            card.innerHTML = `
                <div class="card-image-header" style="background-image: url('${imgUrl}');">
                    ${curs.etiqueta ? `<span class="course-badge">${curs.etiqueta}</span>` : ''}
                </div>
                <div class="card-body">
                    <h3 class="course-title">${curs.titol}</h3>
                    <div class="course-meta">${curs.hores || ''}</div>
                    <div class="progress-container">
                        <div class="progress-bar"><div class="progress-fill" style="width:${mat.progres||0}%; background:${mat.progres>=100?'#10b981':'var(--brand-blue)'}"></div></div>
                        <span class="progress-text">${mat.progres||0}% Completat</span>
                    </div>
                    <a href="index.html?slug=${curs.slug}" class="btn-primary" style="margin-top:auto;">Accedir</a>
                </div>
            `;
            list.appendChild(card);
        });
    } catch(e) { console.error(e); list.innerHTML = '<p>Error.</p>'; }
};

async function loadGrades() {
    // Reutilizar la función que ya tenías o dejarla aquí vacía si quieres
    // ...
}