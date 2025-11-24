// js/dashboard.js

// 1. AL CARGAR LA PÁGINA
document.addEventListener('DOMContentLoaded', () => {
    // Si hay sesión, arrancamos la app
    if (localStorage.getItem('jwt')) {
        window.iniciarApp();
    }
});

// 2. FUNCIÓN DE SALIDA (GLOBAL)
window.logoutApp = function() {
    console.log("Cerrando sesión...");
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    localStorage.clear();
    window.location.href = 'index.html'; // Recarga forzada
};

// 3. FUNCIÓN MAESTRA DE INICIO (GLOBAL)
window.iniciarApp = function() {
    console.log("🚀 Iniciando App SICAP...");
    
    try {
        initHeader();      // Configurar usuario y menú RN
        initNavigation();  // Configurar botones del menú
    } catch (e) {
        console.error("Error en la inicialización:", e);
    }

    // Router Básico: Si no hay ?slug en la URL, mostramos el Dashboard
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('slug')) {
        // Por defecto cargamos 'dashboard' (Mis cursos)
        // Si quieres que cargue otra cosa, cambia esto
        window.showView('dashboard');
    }
};

// --- GESTIÓN CABECERA (Usuario, Dropdown) ---
function initHeader() {
    const userJson = localStorage.getItem('user');
    if (!userJson) return;

    let user = {};
    try { user = JSON.parse(userJson); } catch (e) { return; }

    // Calcular Iniciales
    let initials = "US";
    if (user.nombre) {
        initials = user.nombre.charAt(0) + (user.apellidos ? user.apellidos.charAt(0) : '');
    } else if (user.username) {
        initials = user.username.substring(0, 2);
    }
    
    // Rellenar DOM
    const els = {
        initials: document.getElementById('user-initials'),
        dropName: document.getElementById('dropdown-username'),
        dropEmail: document.getElementById('dropdown-email'),
        // Elementos de la vista perfil
        profAvatar: document.getElementById('profile-avatar-big'),
        profName: document.getElementById('profile-name-display'),
        profDni: document.getElementById('profile-dni-display')
    };
    
    if (els.initials) els.initials.innerText = initials.toUpperCase();
    if (els.dropName) els.dropName.innerText = user.nombre ? `${user.nombre} ${user.apellidos}` : user.username;
    if (els.dropEmail) els.dropEmail.innerText = user.email;
    
    // Rellenar vista perfil (anticipado)
    if (els.profAvatar) els.profAvatar.innerText = initials.toUpperCase();
    if (els.profName) els.profName.innerText = els.dropName.innerText;
    if (els.profDni) els.profDni.innerText = user.username;

    // Lógica del Menú Desplegable (RN)
    const trigger = document.getElementById('user-menu-trigger');
    const menu = document.getElementById('user-dropdown-menu');
    
    if (trigger && menu) {
        // Limpiamos eventos anteriores clonando el nodo
        const newTrigger = trigger.cloneNode(true);
        trigger.parentNode.replaceChild(newTrigger, trigger);

        newTrigger.onclick = (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
        };

        // Cerrar al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!newTrigger.contains(e.target)) {
                menu.classList.remove('show');
            }
        });
    }
}

// --- GESTIÓN NAVEGACIÓN (Router) ---
function initNavigation() {
    // Referencias a las vistas
    const views = {
        home: document.getElementById('catalog-view'),      // Catálogo
        dashboard: document.getElementById('dashboard-view'), // Mis cursos
        profile: document.getElementById('profile-view'),     // Perfil
        grades: document.getElementById('grades-view'),       // Notas
        exam: document.getElementById('exam-view')            // Examen
    };

    // Función global para cambiar vista
    window.showView = function(viewName) {
        console.log("Navegando a:", viewName);
        
        // Ocultar todas
        Object.values(views).forEach(el => { if(el) el.style.display = 'none'; });
        
        // Mostrar la deseada
        if(views[viewName]) {
            views[viewName].style.display = viewName === 'exam' ? 'flex' : 'block';
        }

        // Gestionar clase 'active' en el menú superior
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        if(viewName === 'home') document.getElementById('nav-catalog')?.classList.add('active');
        if(viewName === 'profile') document.getElementById('nav-profile')?.classList.add('active');
        if(viewName === 'dashboard') document.getElementById('nav-dashboard')?.classList.add('active');

        // Cargar datos específicos
        if(viewName === 'dashboard') loadUserCourses();
        if(viewName === 'home') loadCatalog();
        if(viewName === 'profile') loadFullProfile();
        if(viewName === 'grades') loadGrades();
    };

    // ASIGNAR EVENTOS A LOS BOTONES DEL MENÚ (Usando los IDs del nuevo HTML)
    const btnHome = document.getElementById('nav-catalog');
    const btnProfile = document.getElementById('nav-profile');
    const btnDash = document.getElementById('nav-dashboard');
    
    if(btnHome) btnHome.onclick = (e) => { e.preventDefault(); window.showView('home'); };
    if(btnProfile) btnProfile.onclick = (e) => { e.preventDefault(); window.showView('profile'); };
    if(btnDash) btnDash.onclick = (e) => { e.preventDefault(); window.showView('dashboard'); };

    // Iconos (Campana y Mensaje)
    const btnNotifs = document.getElementById('btn-notifs');
    const btnMsgs = document.getElementById('btn-messages');
    
    if(btnNotifs) btnNotifs.onclick = () => alert("No tens noves notificacions.");
    if(btnMsgs) btnMsgs.onclick = () => alert("Safata d'entrada buida.");

    // Enlaces del Dropdown (Perfil, Notas...)
    // Buscamos los <a> dentro de la lista
    const dropLinks = document.querySelectorAll('.user-dropdown ul li a');
    
    // Mapeo: 0=Perfil, 1=Notas, 2=Pref, 3=Salir
    if(dropLinks[0]) dropLinks[0].onclick = (e) => { e.preventDefault(); window.showView('profile'); };
    if(dropLinks[1]) dropLinks[1].onclick = (e) => { e.preventDefault(); window.showView('grades'); };
    if(dropLinks[2]) dropLinks[2].onclick = (e) => { e.preventDefault(); alert("Preferències en construcció."); };
    // El 3 es Logout, que ya tiene onclick="logoutApp()" en el HTML
}

// --- CARGAS DE DATOS (API) ---

// 1. MIS CURSOS
async function loadUserCourses() {
    const list = document.getElementById('courses-list');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));

    if(!list || !token || !user) return;
    list.innerHTML = '<div class="loader"></div>';

    try {
        const query = `filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge`;
        const url = `${STRAPI_URL}/api/matriculas?${query}`;
        
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if(!res.ok) throw new Error("Error API");
        const json = await res.json();
        
        list.innerHTML = '';
        if(!json.data || json.data.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">No estàs matriculat a cap curs actualment.</p>';
            return;
        }

        json.data.forEach(mat => {
            const curs = mat.curs; if(!curs) return;
            
            let imgUrl = 'img/logo-sicap.png';
            if(curs.imatge) {
                const imgObj = Array.isArray(curs.imatge) ? curs.imatge[0] : curs.imatge;
                if(imgObj?.url) imgUrl = imgObj.url.startsWith('/') ? STRAPI_URL + imgObj.url : imgObj.url;
            }

            const progressColor = mat.progres >= 100 ? '#10b981' : 'var(--brand-blue)';
            
            const card = document.createElement('div');
            card.className = 'course-card-item';
            card.innerHTML = `
                <div class="card-image-header" style="background-image: url('${imgUrl}');">
                    ${curs.etiqueta ? `<span class="course-badge">${curs.etiqueta}</span>` : ''}
                </div>
                <div class="card-body">
                    <h3 class="course-title">${curs.titol}</h3>
                    <div class="course-meta"><i class="fa-regular fa-clock"></i> ${curs.hores || ''}</div>
                    
                    <div class="progress-container">
                        <div class="progress-bar"><div class="progress-fill" style="width:${mat.progres||0}%; background:${progressColor}"></div></div>
                        <span class="progress-text">${mat.progres||0}% Completat</span>
                    </div>
                    <a href="index.html?slug=${curs.slug}" class="btn-primary" style="margin-top:auto; text-align:center;">Accedir</a>
                </div>
            `;
            list.appendChild(card);
        });
    } catch(e) {
        console.error(e);
        list.innerHTML = '<p style="color:red; text-align:center;">Error de connexió.</p>';
    }
}

// 2. PERFIL COMPLETO
async function loadFullProfile() {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    
    // Pre-rellenar email
    const elEmail = document.getElementById('prof-email');
    if(elEmail) elEmail.value = user.email;

    try {
        const url = `${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${user.username}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        
        if(json.data && json.data.length > 0) {
            const afi = json.data[0]; 
            const dataMap = {
                'prof-movil': afi.TelefonoMobil || afi.TelefonoFijo,
                'prof-prov': afi.Provincia,
                'prof-pob': afi.Poblacion,
                'prof-centre': afi.CentroTrabajo,
                'prof-cat': afi.CategoriaProfesional,
                'prof-dir': afi.Direccion,
                'prof-iban': afi.IBAN
            };
            for (const [id, val] of Object.entries(dataMap)) {
                const el = document.getElementById(id);
                if(el) el.value = val || '-';
            }
        }
    } catch(e) { console.error("Error profile", e); }
}

// 3. CATÁLOGO
async function loadCatalog() {
    const container = document.getElementById('catalog-list');
    if(!container) return;
    container.innerHTML = '<div class="loader"></div>';
    
    // Lógica futura para traer cursos no matriculados
    // De momento texto placeholder
    setTimeout(() => {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                <i class="fa-solid fa-book-open" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>Actualment no hi ha nous cursos oberts a inscripció.</p>
                <small>Consulta periòdicament aquest apartat.</small>
            </div>`;
    }, 500);
}

// 4. NOTAS
async function loadGrades() {
    const tbody = document.getElementById('grades-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Sense qualificacions registrades.</td></tr>';
}