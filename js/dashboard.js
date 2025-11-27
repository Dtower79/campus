document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('jwt')) {
        if (!window.appIniciada) {
            window.iniciarApp();
        }
    }
});

// NUEVO: Función para mostrar Modal
window.mostrarModalConfirmacion = function(titulo, mensaje, onConfirm) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-msg').innerText = mensaje;
    
    // Botones
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    // Limpiar eventos anteriores para evitar duplicados
    const newConfirm = btnConfirm.cloneNode(true);
    const newCancel = btnCancel.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);

    newConfirm.onclick = () => {
        modal.style.display = 'none';
        onConfirm();
    };
    newCancel.onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
};

// MODIFICADO: Logout con Modal (Punto 10)
window.logoutApp = function() {
    window.mostrarModalConfirmacion(
        "Tancar Sessió", 
        "Estàs segur que vols sortir del campus?", 
        () => {
            localStorage.clear(); // Ojo: en Bloque 2 guardaremos estado del test aquí
            window.location.href = 'index.html';
        }
    );
};

// NUEVO: Navegación sin recarga (Punto 23)
window.tornarAlDashboard = function() {
    // Ocultar vista examen
    document.getElementById('exam-view').style.display = 'none';
    // Mostrar dashboard
    document.getElementById('dashboard-view').style.display = 'block';
    // Limpiar URL param (visual)
    window.history.pushState({}, document.title, window.location.pathname);
    // Recargar lista de cursos por si hubo progreso
    if(window.loadUserCourses) window.loadUserCourses();
    window.scrollTo(0,0);
};

window.appIniciada = false;

window.iniciarApp = function() {
    if (window.appIniciada) return;
    window.appIniciada = true;

    console.log("🚀 Iniciando SICAP App (Full + Grades)...");

    try { initHeaderData(); } catch (e) { console.error("Error header:", e); }

    // Retardo para asegurar DOM
    setTimeout(() => {
        setupDirectClicks();
    }, 100);

    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('slug')) {
        window.showView('dashboard');
    } else {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('exam-view').style.display = 'flex';
    }
};

/**
 * CONEXIÓN MANUAL DE BOTONES
 */
function setupDirectClicks() {
    // A. CAMPANA
    const btnBell = document.getElementById('btn-notifs');
    if (btnBell) btnBell.onclick = (e) => { e.stopPropagation(); alert("No tens notificacions."); };

    // B. MENSAJES
    const btnMsg = document.getElementById('btn-messages');
    if (btnMsg) btnMsg.onclick = (e) => { e.stopPropagation(); alert("Missatgeria en manteniment."); };

    // C. HAMBURGUESA
    const btnMobile = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('main-nav');
    if (btnMobile && navMenu) {
        btnMobile.onclick = (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('show-mobile');
        };
    }

    // D. USUARIO (RN)
    const btnUser = document.getElementById('user-menu-trigger');
    const userDropdown = document.getElementById('user-dropdown-menu');
    if (btnUser && userDropdown) {
        btnUser.onclick = (e) => {
            e.stopPropagation();
            if (userDropdown.style.display === 'flex') {
                userDropdown.style.display = 'none';
                userDropdown.classList.remove('show');
            } else {
                closeAllMenus();
                userDropdown.style.display = 'flex';
                userDropdown.classList.add('show');
            }
        };
    }

    // E. ITEMS DEL DESPLEGABLE
    const links = document.querySelectorAll('#user-dropdown-menu a');
    links.forEach(link => {
        link.onclick = (e) => {
            const action = link.getAttribute('data-action');
            if (action) {
                e.preventDefault();
                window.showView(action);
                closeAllMenus();
            } else if (link.id === 'btn-logout-dropdown' || link.innerText.includes('Sortir')) {
                e.preventDefault();
                window.logoutApp();
            }
        };
    });

    // F. CLIC GLOBAL
    document.body.addEventListener('click', closeAllMenus);

    // G. NAVEGACIÓN PRINCIPAL
    const navButtons = [
        { id: 'nav-catalog', view: 'home' },
        { id: 'nav-profile', view: 'profile' },
        { id: 'nav-dashboard', view: 'dashboard' }
    ];
    navButtons.forEach(btn => {
        const el = document.getElementById(btn.id);
        if (el) {
            el.onclick = (e) => {
                e.preventDefault();
                window.showView(btn.view);
                closeAllMenus();
            };
        }
    });
}

function closeAllMenus() {
    const userDropdown = document.getElementById('user-dropdown-menu');
    const navMenu = document.getElementById('main-nav');
    if (userDropdown) { userDropdown.style.display = 'none'; userDropdown.classList.remove('show'); }
    if (navMenu) { navMenu.classList.remove('show-mobile'); }
}

// --- AUXILIARES ---
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

// --- ROUTER ---
window.showView = function(viewName) {
    ['catalog-view', 'dashboard-view', 'profile-view', 'grades-view', 'exam-view'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    let targetId = '';
    if(viewName === 'home') targetId = 'catalog-view';
    if(viewName === 'dashboard') targetId = 'dashboard-view';
    if(viewName === 'profile') targetId = 'profile-view';
    if(viewName === 'grades') targetId = 'grades-view';
    if(viewName === 'exam') targetId = 'exam-view';

    const targetEl = document.getElementById(targetId);
    if(targetEl) targetEl.style.display = viewName === 'exam' ? 'flex' : 'block';

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navMap = { 'home': 'nav-catalog', 'profile': 'nav-profile', 'dashboard': 'nav-dashboard' };
    if (navMap[viewName]) {
        const activeBtn = document.getElementById(navMap[viewName]);
        if(activeBtn) activeBtn.classList.add('active');
    }

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
    console.log("📥 Cargando perfil extendido...");
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    
    // 1. Email y botón de contacto
    const emailIn = document.getElementById('prof-email');
    if(emailIn) emailIn.value = user.email || '-';

    // Arreglo del botón de correo
    const mailBtn = document.querySelector('.profile-data-form button');
    if(mailBtn) {
        mailBtn.onclick = () => window.location.href = 'mailto:sicap@sicap.cat';
    }

    try {
        // 2. Petición a Strapi
        const res = await fetch(`${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${user.username}`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const json = await res.json();
        
        console.log("📦 Respuesta API Afiliados:", json); // MIRAR CONSOLA SI FALLA

        if(json.data && json.data.length > 0) {
            const afi = json.data[0];
            
            // 3. Mapeo Inteligente (Prueba Mayúsculas y Minúsculas)
            // Helper para buscar propiedad ignorando mayúsculas
            const getVal = (key) => afi[key] || afi[key.charAt(0).toLowerCase() + key.slice(1)] || '-';

            const map = {
                'prof-movil': 'TelefonoMobil', // Intenta TelefonoMobil o telefonoMobil
                'prof-prov': 'Provincia',
                'prof-pob': 'Poblacion',
                'prof-centre': 'CentroTrabajo',
                'prof-cat': 'CategoriaProfesional',
                'prof-dir': 'Direccion',
                'prof-iban': 'IBAN'
            };

            for (const [domId, apiField] of Object.entries(map)) { 
                const el = document.getElementById(domId); 
                if(el) el.value = getVal(apiField);
            }
        } else {
            console.warn("⚠️ No se encontró afiliado con DNI:", user.username);
        }
    } catch(e) { 
        console.error("❌ Error cargando perfil:", e); 
    }
}

async function loadCatalog() { 
    document.getElementById('catalog-list').innerHTML = '<p style="text-align:center; padding:20px;">No hi ha nous cursos.</p>'; 
}

// --- FUNCIÓN DE NOTAS (RESTAURADA) ---
async function loadGrades() {
    const tbody = document.getElementById('grades-table-body');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if(!tbody || !token) return;
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;"><div class="loader"></div></td></tr>';

    try {
        // Pedimos TODAS las matrículas del usuario (sin filtrar por estado)
        const query = `filters[users_permissions_user][id][$eq]=${user.id}&populate=curs`;
        const res = await fetch(`${STRAPI_URL}/api/matriculas?${query}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();

        tbody.innerHTML = ''; // Limpiar loader

        if(!json.data || json.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No tens cursos matriculats.</td></tr>';
            return;
        }

        json.data.forEach(mat => {
            const curs = mat.curs;
            if(!curs) return;

            // Determinar estado
            const isCompleted = mat.estat === 'completat' || mat.progres === 100;
            const statusHtml = isCompleted 
                ? '<span style="color:#10b981; font-weight:bold;">Completat</span>' 
                : '<span style="color:var(--brand-blue);">En Curs</span>';
            
            // Nota (Si no hay, ponemos guión)
            const nota = mat.nota_final !== undefined && mat.nota_final !== null ? mat.nota_final : '-';

            // Diploma (Botón o texto)
            const diplomaHtml = isCompleted 
                ? `<button class="btn-small" onclick="alert('Descàrrega de diploma properament')"><i class="fa-solid fa-download"></i> PDF</button>` 
                : '<small style="color:#999;">Pendent</small>';

            // Insertar fila
            const row = `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 15px;"><strong>${curs.titol}</strong></td>
                    <td style="padding: 15px;">${statusHtml}</td>
                    <td style="padding: 15px;">${nota}</td>
                    <td style="padding: 15px;">${diplomaHtml}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch(e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error carregant qualificacions.</td></tr>';
    }
}