document.addEventListener('DOMContentLoaded', () => {
    // Solo iniciamos la APP si hay token.
    // La lógica de login/registro/recuperar contraseña ahora está aislada en auth.js
    if (localStorage.getItem('jwt')) {
        if (!window.appIniciada) {
            window.iniciarApp();
        }
    }
});

// ==========================================
// PUNTO 9: CONTROL DE INACTIVIDAD (15 MIN)
// ==========================================
let inactivityTimer;
const TIMEOUT_LIMIT = 15 * 60 * 1000; // 15 minutos

function resetInactivityTimer() {
    if(!localStorage.getItem('jwt')) return; 
    
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        localStorage.clear();
        alert("Sessió tancada per inactivitat (15 min)."); // El alert aquí es necesario para bloquear el navegador hasta que el usuario acepte
        window.location.href = 'index.html';
    }, TIMEOUT_LIMIT);
}

['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer);
});


// ==========================================
// 1. SISTEMA DE MODALES PERSONALIZADOS
// ==========================================
window.mostrarModalConfirmacion = function(titulo, mensaje, onConfirm) {
    const modal = document.getElementById('custom-modal');
    if(!modal) return; 
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-msg');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    titleEl.innerText = titulo;
    titleEl.style.color = "var(--brand-blue)"; 
    msgEl.innerText = mensaje;
    
    btnConfirm.innerText = "Confirmar";
    btnConfirm.disabled = false;
    btnConfirm.style.background = ""; 
    btnCancel.style.display = "block"; 

    const newConfirm = btnConfirm.cloneNode(true);
    const newCancel = btnCancel.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);

    newConfirm.onclick = () => {
        if(onConfirm) onConfirm();
        else modal.style.display = 'none';
    };
    newCancel.onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
};

window.mostrarModalError = function(mensaje, onCloseAction) {
    const modal = document.getElementById('custom-modal');
    // Fallback si se llama antes de cargar el DOM (raro, pero posible)
    if(!modal) { console.warn("Modal no cargado:", mensaje); return; }

    const titleEl = document.getElementById('modal-title');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    titleEl.innerText = "Atenció"; // O "Recuperació" si es el caso, pero genérico funciona bien
    titleEl.style.color = "var(--brand-blue)"; // Azul por defecto, rojo si es error crítico
    document.getElementById('modal-msg').innerText = mensaje;

    btnCancel.style.display = 'none'; 
    btnConfirm.innerText = "Entesos";
    btnConfirm.style.background = "var(--brand-blue)"; // Azul corporativo
    btnConfirm.disabled = false;
    
    const newConfirm = btnConfirm.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    
    newConfirm.onclick = () => {
        modal.style.display = 'none';
        if (onCloseAction) {
            onCloseAction(); 
        }
    };

    modal.style.display = 'flex';
};

// ==========================================
// 2. FUNCIONES PRINCIPALES APP
// ==========================================
window.logoutApp = function() {
    window.mostrarModalConfirmacion(
        "Tancar Sessió", 
        "Estàs segur que vols sortir del campus?", 
        () => {
            localStorage.clear(); 
            window.location.href = 'index.html';
        }
    );
};

window.tornarAlDashboard = function() {
    document.getElementById('exam-view').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    window.showView('dashboard');
    const url = new URL(window.location);
    url.searchParams.delete('slug');
    window.history.pushState({}, '', url);
    window.scrollTo(0,0);
};

window.appIniciada = false;

window.iniciarApp = function() {
    if (window.appIniciada) return;
    window.appIniciada = true;
    console.log("🚀 Iniciando SICAP App...");
    
    resetInactivityTimer();
    
    try { initHeaderData(); } catch (e) { console.error("Error header:", e); }
    
    setTimeout(() => { setupDirectClicks(); }, 100);

    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('slug')) {
        window.showView('dashboard');
    } else {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('exam-view').style.display = 'flex';
    }
};

function setupDirectClicks() {
    // NOTIFICACIONES
    const btnBell = document.getElementById('btn-notifs');
    const bellDot = btnBell ? btnBell.querySelector('.notification-dot') : null;

    if (localStorage.getItem('notification_pending') === 'true') {
        if (bellDot) { bellDot.style.display = 'block'; bellDot.classList.add('animate-ping'); }
    } else {
        if (bellDot) bellDot.style.display = 'none';
    }

    if (btnBell) btnBell.onclick = (e) => { 
        e.stopPropagation();
        const hasPending = localStorage.getItem('notification_pending') === 'true';
        if (hasPending) {
            if (bellDot) { bellDot.style.display = 'none'; bellDot.classList.remove('animate-ping'); }
            localStorage.removeItem('notification_pending');
            window.mostrarModalError("🔔 Tens novetats: T'has matriculat correctament al nou curs.");
        } else {
            window.mostrarModalError("No tens noves notificacions.");
        }
    };

    // MENSAJERIA
    const btnMsg = document.getElementById('btn-messages');
    if (btnMsg) btnMsg.onclick = (e) => { 
        e.stopPropagation(); 
        window.mostrarModalError("El sistema de missatgeria estarà disponible properament.");
    };

    const btnMobile = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('main-nav');
    if (btnMobile && navMenu) {
        btnMobile.onclick = (e) => {
            e.stopPropagation();
            navMenu.classList.toggle('show-mobile');
        };
    }

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

    document.body.addEventListener('click', closeAllMenus);

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

function parseStrapiText(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(block => {
            if (block.type === 'paragraph' || !block.type) return block.children?.map(c => c.text).join('') || '';
            if (block.type === 'list') return block.children?.map(item => '• ' + (item.children?.map(c => c.text).join('') || '')).join('\n');
            if (block.type === 'heading') return (block.children?.map(c => c.text).join('') || '') + '\n';
            return '';
        }).filter(text => text.trim() !== '').join('\n\n');
    }
    return '';
}

function generarHtmlDescripcion(rawText, idUnico) {
    const textoLimpio = parseStrapiText(rawText);
    if (!textoLimpio) return '';
    const MAX_CHARS = 100;
    const textoHtmlCompleto = textoLimpio.replace(/\n/g, '<br>');
    if (textoLimpio.length <= MAX_CHARS) return `<div class="course-desc-container"><p class="course-desc">${textoHtmlCompleto}</p></div>`;
    const safeFullText = encodeURIComponent(textoHtmlCompleto);
    const textoCorto = textoLimpio.substring(0, MAX_CHARS) + '...';
    return `<div class="course-desc-container"><p class="course-desc short" id="desc-p-${idUnico}" data-full="${safeFullText}">${textoCorto}</p><span class="read-more-link" id="desc-btn-${idUnico}" onclick="toggleDesc('${idUnico}')">Mostrar més</span></div>`;
}

window.toggleDesc = function(id) {
    const p = document.getElementById(`desc-p-${id}`);
    const btn = document.getElementById(`desc-btn-${id}`);
    if (btn.innerText === 'Mostrar més') {
        p.innerHTML = decodeURIComponent(p.getAttribute('data-full'));
        p.classList.remove('short');
        btn.innerText = 'Mostrar menys';
    } else {
        const fullHtml = decodeURIComponent(p.getAttribute('data-full'));
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = fullHtml;
        const plainText = tempDiv.textContent || tempDiv.innerText || "";
        p.innerText = plainText.substring(0, 100) + '...';
        p.classList.add('short');
        btn.innerText = 'Mostrar més';
    }
};

async function renderCoursesLogic(viewMode) {
    const listId = viewMode === 'dashboard' ? 'courses-list' : 'catalog-list';
    const list = document.getElementById(listId);
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if(!list || !token) return;
    list.innerHTML = '<div class="loader"></div>';

    try {
        const resMat = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge`, { headers: { 'Authorization': `Bearer ${token}` } });
        const jsonMat = await resMat.json();
        const userMatriculas = jsonMat.data || [];
        let cursosAMostrar = [];

        if (viewMode === 'dashboard') {
            cursosAMostrar = userMatriculas.map(m => ({ ...m.curs, _matricula: m }));
        } else {
            const resCat = await fetch(`${STRAPI_URL}/api/cursos?populate=imatge`, { headers: { 'Authorization': `Bearer ${token}` } });
            const jsonCat = await resCat.json();
            cursosAMostrar = jsonCat.data.map(c => {
                const existingMat = userMatriculas.find(m => (m.curs.documentId || m.curs.id) === (c.documentId || c.id));
                return { ...c, _matricula: existingMat };
            });
        }

        cursosAMostrar.sort((a, b) => {
            const dateA = new Date(a.fecha_inicio || a.publishedAt);
            const dateB = new Date(b.fecha_inicio || b.publishedAt);
            return dateB - dateA; 
        });

        list.innerHTML = '';
        if(cursosAMostrar.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding:20px;">No hi ha cursos disponibles.</p>';
            return;
        }

        cursosAMostrar.forEach((curs, index) => {
            const cursId = curs.documentId || curs.id;
            const safeTitle = curs.titol.replace(/'/g, "\\'"); 
            let imgUrl = 'img/logo-sicap.png';
            if(curs.imatge) { const img = Array.isArray(curs.imatge) ? curs.imatge[0] : curs.imatge; if(img?.url) imgUrl = img.url.startsWith('/') ? STRAPI_URL + img.url : img.url; }

            const hoy = new Date();
            const fechaInicio = curs.fecha_inicio ? new Date(curs.fecha_inicio) : new Date(curs.publishedAt);
            const esFuturo = fechaInicio > hoy;
            const dateStr = fechaInicio.toLocaleDateString('ca-ES');

            let badgeOverlay = esFuturo ? `<span class="course-badge" style="background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba;"><i class="fa-regular fa-calendar"></i> Properament: ${dateStr}</span>` : (curs.etiqueta ? `<span class="course-badge">${curs.etiqueta}</span>` : '');
            let tagsHtml = '<div class="course-tags">';
            if (!esFuturo) tagsHtml += `<span class="tag tag-date"><i class="fa-solid fa-check"></i> Iniciat: ${dateStr}</span>`;
            if (curs._matricula && viewMode === 'home') tagsHtml += `<span class="tag tag-status"><i class="fa-solid fa-user-check"></i> Ja matriculat</span>`;
            tagsHtml += '</div>';

            const descHtml = generarHtmlDescripcion(curs.descripcio || curs.resum, index);
            const horasHtml = `<div class="course-hours"><i class="fa-regular fa-clock"></i> ${curs.hores ? curs.hores + ' Hores' : 'Durada no especificada'}</div>`;
            let actionHtml = '', progressHtml = '';

            if (curs._matricula) {
                const mat = curs._matricula;
                const color = mat.progres >= 100 ? '#10b981' : 'var(--brand-blue)';
                progressHtml = `<div class="progress-container"><div class="progress-bar"><div class="progress-fill" style="width:${mat.progres||0}%; background:${color}"></div></div><span class="progress-text">${mat.progres||0}% Completat</span></div>`;
                actionHtml = esFuturo ? `<button class="btn-primary" style="background-color:#ccc; cursor:not-allowed;" onclick="alertFechaFutura('${safeTitle}', '${dateStr}')">Accedir</button>` : `<a href="index.html?slug=${curs.slug}" class="btn-primary">Accedir</a>`;
            } else {
                actionHtml = `<button class="btn-enroll" onclick="window.solicitarMatricula('${cursId}', '${safeTitle}')">Matricular-me</button>`;
            }

            list.innerHTML += `<div class="course-card-item"><div class="card-image-header" style="background-image: url('${imgUrl}');">${badgeOverlay}</div><div class="card-body"><h3 class="course-title">${curs.titol}</h3>${horasHtml}${descHtml}${tagsHtml}${progressHtml}${actionHtml}</div></div>`;
        });
    } catch(e) { console.error(e); list.innerHTML = '<p style="color:red;">Error de connexió al carregar cursos.</p>'; }
}

window.alertFechaFutura = function(titol, fecha) { window.mostrarModalError(`El curs "${titol}" estarà disponible el ${fecha}. Encara no hi pots accedir.`); };

window.solicitarMatricula = function(courseId, courseTitle) {
    window.mostrarModalConfirmacion("Confirmar Matriculació", `Vols inscriure't al curs "${courseTitle}"?`, async () => {
        const btnConf = document.getElementById('modal-btn-confirm'); btnConf.innerText = "Processant..."; btnConf.disabled = true;
        try {
            const user = JSON.parse(localStorage.getItem('user')); const token = localStorage.getItem('jwt'); const now = new Date().toISOString();
            const payload = { data: { curs: courseId, users_permissions_user: Number(user.id), progres: 0, estat: 'actiu', data_inici: now, progres_detallat: {} } };
            const res = await fetch(`${STRAPI_URL}/api/matriculas`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
            if (res.ok) {
                document.getElementById('custom-modal').style.display = 'none';
                localStorage.setItem('notification_pending', 'true');
                const bellDot = document.querySelector('.notification-dot');
                if(bellDot) { bellDot.style.display = 'block'; bellDot.classList.add('animate-ping'); setTimeout(() => bellDot.classList.remove('animate-ping'), 5000); }
                window.showView('dashboard'); window.mostrarModalError("Matrícula realitzada correctament! Ja pots accedir al curs.");
            } else {
                const err = await res.json(); document.getElementById('custom-modal').style.display = 'none';
                setTimeout(() => window.mostrarModalError("Error al matricular: " + (err.error?.message || "Dades incorrectes (400)")), 200);
            }
        } catch (e) { document.getElementById('custom-modal').style.display = 'none'; setTimeout(() => window.mostrarModalError("Error de connexió."), 200); }
    });
};

window.loadUserCourses = async function() { await renderCoursesLogic('dashboard'); };
window.loadCatalog = async function() { await renderCoursesLogic('home'); };

async function loadFullProfile() {
    const user = JSON.parse(localStorage.getItem('user')); const token = localStorage.getItem('jwt');
    const emailIn = document.getElementById('prof-email'); if(emailIn) emailIn.value = user.email || '-';
    const mailBtn = document.querySelector('.profile-data-form button'); if(mailBtn) mailBtn.onclick = () => window.location.href = 'mailto:sicap@sicap.cat';
    try {
        const res = await fetch(`${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${user.username}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        if(json.data && json.data.length > 0) {
            const afi = json.data[0]; const getVal = (key) => afi[key] || afi[key.charAt(0).toLowerCase() + key.slice(1)] || '-';
            const map = { 'prof-movil': 'TelefonoMobil', 'prof-prov': 'Provincia', 'prof-pob': 'Poblacion', 'prof-centre': 'CentroTrabajo', 'prof-cat': 'CategoriaProfesional', 'prof-dir': 'Direccion', 'prof-iban': 'IBAN' };
            for (const [domId, apiField] of Object.entries(map)) { const el = document.getElementById(domId); if(el) el.value = getVal(apiField); }
        }
        const resMat = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate=curs`, { headers: { 'Authorization': `Bearer ${token}` } });
        const jsonMat = await resMat.json(); const matriculas = jsonMat.data || [];
        let iniciados = matriculas.length, acabados = 0, horasTotales = 0;
        matriculas.forEach(m => { if (m.estat === 'completat' || m.progres >= 100) { acabados++; if (m.curs && m.curs.hores) horasTotales += (parseInt(m.curs.hores) || 0); } });
        document.getElementById('profile-stats-container').style.display = 'block'; document.getElementById('stat-started').innerText = iniciados; document.getElementById('stat-finished').innerText = acabados; document.getElementById('stat-hours').innerText = horasTotales + 'h';
    } catch(e) { console.error("Error perfil:", e); }
}

async function loadGrades() {
    const tbody = document.getElementById('grades-table-body'); const token = localStorage.getItem('jwt'); const user = JSON.parse(localStorage.getItem('user'));
    if(!tbody || !token) return; tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;"><div class="loader"></div></td></tr>';
    try {
        const res = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate=curs`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json(); tbody.innerHTML = '';
        if(!json.data || json.data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No tens cursos matriculats.</td></tr>'; return; }
        json.data.forEach(mat => {
            const curs = mat.curs; if(!curs) return;
            const isCompleted = mat.estat === 'completat' || mat.progres >= 100;
            const statusHtml = isCompleted ? '<span style="color:#10b981; font-weight:bold;">Completat</span>' : '<span style="color:var(--brand-blue);">En Curs</span>';
            const diplomaHtml = isCompleted ? `<button class="btn-small" onclick="alert('Pots descarregar el diploma des de la secció del curs')"><i class="fa-solid fa-download"></i> PDF</button>` : '<small style="color:#999;">Pendent</small>';
            tbody.innerHTML += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 15px;"><strong>${curs.titol}</strong></td><td style="padding: 15px;">${statusHtml}</td><td style="padding: 15px;">${mat.nota_final||'-'}</td><td style="padding: 15px;">${diplomaHtml}</td></tr>`;
        });
    } catch(e) { console.error(e); tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error carregant qualificacions.</td></tr>'; }
}