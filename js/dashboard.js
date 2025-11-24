document.addEventListener('DOMContentLoaded', () => {
    // Verificamos si hay sesión
    if (localStorage.getItem('jwt')) {
        // Si la app no ha arrancado aún, la arrancamos
        if (!window.appIniciada) {
            window.iniciarApp();
        }
    }
});

window.logoutApp = function() {
    if(confirm("Segur que vols tancar la sessió?")) {
        localStorage.clear();
        window.location.href = 'index.html';
    }
};

window.appIniciada = false;

window.iniciarApp = function() {
    if (window.appIniciada) return;
    window.appIniciada = true;

    console.log("🚀 Iniciando SICAP App (Modo Directo)...");

    // 1. Pintar datos del usuario (Nombres, iniciales...)
    try { 
        initHeaderData(); 
    } catch (e) { console.error("Error pintando header:", e); }

    // 2. ACTIVAR LOS CLICS (Aquí está la magia nueva)
    setTimeout(() => {
        setupDirectClicks();
    }, 100); // Pequeño retardo para asegurar que el DOM está listo

    // 3. Router (Decidir qué vista mostrar)
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('slug')) {
        window.showView('dashboard');
    } else {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('exam-view').style.display = 'flex';
    }
};

/**
 * CONFIGURACIÓN DIRECTA DE CLICS
 * Asignamos eventos uno a uno a los elementos específicos.
 */
function setupDirectClicks() {
    console.log("🔧 Configurando botones del header...");

    // --- A. CAMPANA (Notificaciones) ---
    const btnBell = document.getElementById('btn-notifs');
    if (btnBell) {
        btnBell.onclick = (e) => {
            e.stopPropagation(); // No cerrar otros menús
            alert("No tens notificacions noves.");
        };
    }

    // --- B. BOCADILLO (Mensajes) ---
    const btnMsg = document.getElementById('btn-messages');
    if (btnMsg) {
        btnMsg.onclick = (e) => {
            e.stopPropagation();
            alert("Sistema de missatgeria en manteniment.");
        };
    }

    // --- C. HAMBURGUESA (Móvil) ---
    const btnMobile = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('main-nav');
    if (btnMobile && navMenu) {
        btnMobile.onclick = (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('show-mobile');
        };
    }

    // --- D. USUARIO (RN - Menú desplegable) ---
    const btnUser = document.getElementById('user-menu-trigger');
    const userDropdown = document.getElementById('user-dropdown-menu');
    
    if (btnUser && userDropdown) {
        // Al hacer clic en "RN"
        btnUser.onclick = (e) => {
            e.stopPropagation();
            // Alternar visibilidad
            if (userDropdown.style.display === 'flex') {
                userDropdown.style.display = 'none';
                userDropdown.classList.remove('show');
            } else {
                // Cerrar otros menús si estuvieran abiertos
                if(navMenu) navMenu.classList.remove('show-mobile');
                
                userDropdown.style.display = 'flex';
                userDropdown.classList.add('show');
            }
        };
    }

    // --- E. ENLACES DEL MENÚ USUARIO (Perfil, Notas, Salir) ---
    // Buscamos los enlaces dentro del dropdown
    const links = document.querySelectorAll('#user-dropdown-menu a');
    links.forEach(link => {
        link.onclick = (e) => {
            // Si es navegar (tiene data-action)
            const action = link.getAttribute('data-action');
            if (action) {
                e.preventDefault();
                window.showView(action);
                closeAllMenus();
            }
            // Si es Salir (detectado por ID o texto)
            else if (link.id === 'btn-logout-dropdown' || link.innerText.includes('Sortir')) {
                e.preventDefault();
                window.logoutApp();
            }
        };
    });

    // --- F. CLIC EN CUALQUIER OTRO SITIO (Para cerrar menús) ---
    document.body.addEventListener('click', () => {
        closeAllMenus();
    });
}

// Función auxiliar para limpiar pantalla
function closeAllMenus() {
    const userDropdown = document.getElementById('user-dropdown-menu');
    const navMenu = document.getElementById('main-nav');
    
    if (userDropdown) {
        userDropdown.style.display = 'none';
        userDropdown.classList.remove('show');
    }
    if (navMenu) {
        navMenu.classList.remove('show-mobile');
    }
}

// --- PINTAR DATOS HEADER ---
function initHeaderData() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const setText = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };
    
    let initials = user.nombre ? user.nombre.charAt(0) : user.username.substring(0, 1);
    if (user.apellidos) initials += user.apellidos.charAt(0);
    initials = initials.toUpperCase();

    setText('user-initials', initials);
    setText('dropdown-username', user.nombre ? `${user.nombre} ${user.apellidos}` : user.username);
    setText('dropdown-email', user.email);
    setText('profile-avatar-big', initials);
    setText('profile-name-display', user.nombre ? `${user.nombre} ${user.apellidos}` : user.username);
    setText('profile-dni-display', user.username);
}

// --- ROUTER (Navegación) ---
window.showView = function(viewName) {
    console.log("Navegando a:", viewName);
    
    // 1. Ocultar todo
    const views = ['catalog-view', 'dashboard-view', 'profile-view', 'grades-view', 'exam-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    // 2. Mostrar selección
    let targetId = '';
    if(viewName === 'home') targetId = 'catalog-view';
    if(viewName === 'dashboard') targetId = 'dashboard-view';
    if(viewName === 'profile') targetId = 'profile-view';
    if(viewName === 'grades') targetId = 'grades-view';
    if(viewName === 'exam') targetId = 'exam-view';

    const targetEl = document.getElementById(targetId);
    if(targetEl) {
        targetEl.style.display = viewName === 'exam' ? 'flex' : 'block';
    }

    // 3. Actualizar menú activo
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navId = viewName === 'home' ? 'nav-catalog' : (viewName === 'profile' ? 'nav-profile' : 'nav-dashboard');
    const navBtn = document.getElementById(navId);
    if(navBtn) navBtn.classList.add('active');

    // 4. Cargar datos
    if(viewName === 'dashboard') loadUserCourses();
    if(viewName === 'home') loadCatalog();
    if(viewName === 'profile') loadFullProfile();
    if(viewName === 'grades') loadGrades();
};

// --- CARGADORES DE DATOS ---
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
        if(!json.data || json.data.length === 0) { 
            list.innerHTML = '<p style="text-align:center; padding:20px;">No tens cursos actius.</p>'; return; 
        }
        
        json.data.forEach(mat => {
            const curs = mat.curs; if(!curs) return;
            let imgUrl = 'img/logo-sicap.png';
            if(curs.imatge) { 
                const img = Array.isArray(curs.imatge) ? curs.imatge[0] : curs.imatge; 
                if(img?.url) imgUrl = img.url.startsWith('/') ? STRAPI_URL + img.url : img.url; 
            }
            const color = mat.progres >= 100 ? '#10b981' : 'var(--brand-blue)';
            
            list.innerHTML += `
            <div class="course-card-item">
                <div class="card-image-header" style="background-image: url('${imgUrl}');">
                    ${curs.etiqueta ? `<span class="course-badge">${curs.etiqueta}</span>` : ''}
                </div>
                <div class="card-body">
                    <h3 class="course-title">${curs.titol}</h3>
                    <div class="course-meta">${curs.hores || ''}</div>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${mat.progres||0}%; background:${color}"></div>
                        </div>
                        <span class="progress-text">${mat.progres||0}% Completat</span>
                    </div>
                    <a href="index.html?slug=${curs.slug}" class="btn-primary" style="margin-top:auto; text-align:center;">Accedir</a>
                </div>
            </div>`;
        });
    } catch(e) { list.innerHTML = '<p style="color:red;">Error carregant cursos.</p>'; }
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