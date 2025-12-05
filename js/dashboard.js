/* ==========================================================================
   DASHBOARD.JS (v7.0 Optimized)
   Lógica principal: Auth, Navegación, Notificaciones y Mensajería
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. CHEQUEO DE SESIÓN
    const token = localStorage.getItem('jwt');
    if (token) {
        const overlay = document.getElementById('login-overlay');
        const app = document.getElementById('app-container');
        
        if (overlay) overlay.style.display = 'none';
        if (app) app.style.display = 'block';

        if (!window.appIniciada) {
            window.iniciarApp();
        }
    }

    // 2. RECUPERACIÓN CONTRASEÑA
    const forgotLink = document.getElementById('forgot-pass');
    if(forgotLink) {
        forgotLink.onclick = (e) => {
            e.preventDefault();
            window.mostrarModalError("S'ha enviat un correu de recuperació a la teva adreça d'afiliació.");
        }
    }

    // 3. FOOTER Y SCROLL
    const footer = document.getElementById('app-footer');
    if(footer) footer.style.display = 'block';

    if(!document.getElementById('scroll-top-btn')) {
        const btn = document.createElement('button');
        btn.id = 'scroll-top-btn';
        btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        btn.onclick = () => window.scrollTo({top: 0, behavior: 'smooth'});
        document.body.appendChild(btn);
        
        window.onscroll = () => {
            if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
                btn.style.display = "flex";
            } else {
                btn.style.display = "none";
            }
        };
    }
});

// ==========================================
// 1. NAVEGACIÓN SPA
// ==========================================
window.showView = function(viewName) {
    // Ocultar todas
    ['catalog-view', 'dashboard-view', 'profile-view', 'grades-view', 'exam-view'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    // Mapeo vistas
    let targetId = '';
    if(viewName === 'home') targetId = 'catalog-view';
    if(viewName === 'dashboard') targetId = 'dashboard-view';
    if(viewName === 'profile') targetId = 'profile-view';
    if(viewName === 'grades') targetId = 'grades-view';
    if(viewName === 'exam') targetId = 'exam-view';

    const targetEl = document.getElementById(targetId);
    if(targetEl) targetEl.style.display = viewName === 'exam' ? 'flex' : 'block';

    // Actualizar menú activo
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navMap = { 'home': 'nav-catalog', 'profile': 'nav-profile', 'dashboard': 'nav-dashboard' };
    if (navMap[viewName]) {
        const activeBtn = document.getElementById(navMap[viewName]);
        if(activeBtn) activeBtn.classList.add('active');
    }

    // Cargar datos según vista
    if(viewName === 'dashboard') loadUserCourses();
    if(viewName === 'home') loadCatalog();
    if(viewName === 'profile') loadFullProfile();
    if(viewName === 'grades') loadGrades();
};

window.appIniciada = false;

window.iniciarApp = function() {
    if (window.appIniciada) return;
    window.appIniciada = true;
    console.log("🚀 SICAP App: Iniciant sistema...");
    
    startInactivityTimers();
    try { initHeaderData(); } catch (e) { console.error("Error header:", e); }
    
    // Iniciar polling de notificaciones
    checkRealNotifications(); 
    setInterval(checkRealNotifications, 60000); // Cada minuto

    setTimeout(() => { setupDirectClicks(); }, 100);

    // Comprobar si venimos a un examen directo (URL Slug)
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('slug')) { 
        window.showView('dashboard'); 
    } else { 
        document.getElementById('dashboard-view').style.display = 'none'; 
        document.getElementById('exam-view').style.display = 'flex'; 
    }
};

// ==========================================
// 2. INACTIVIDAD Y SESIÓN
// ==========================================
let warningTimer;
let logoutTimer;
const WARNING_TIME = 10 * 60 * 1000; // 10 minutos

function startInactivityTimers() {
    if(!localStorage.getItem('jwt')) return;
    clearTimeout(warningTimer);
    clearTimeout(logoutTimer);
    warningTimer = setTimeout(() => { mostrarModalInactividad(); }, WARNING_TIME);
}

function resetInactivity() {
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    // Si el modal de inactividad ya está abierto, no reseteamos
    if (modal && modal.style.display === 'flex' && titleEl && titleEl.innerText === "Inactivitat Detectada") return; 
    startInactivityTimers();
}

['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => { 
    document.addEventListener(evt, resetInactivity); 
});

function mostrarModalInactividad() {
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-msg');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    titleEl.innerText = "Inactivitat Detectada";
    titleEl.style.color = "var(--brand-red)";
    msgEl.innerHTML = `<p>Portes 10 minuts sense activitat.</p><p>La sessió es tancarà automàticament en:</p><div id="logout-countdown" class="modal-timer-text">05:00</div><p>Vols continuar connectat?</p>`;

    btnCancel.style.display = 'block'; btnCancel.innerText = "Tancar Sessió";
    btnConfirm.innerText = "Estendre Sessió"; btnConfirm.style.background = "var(--brand-blue)";
    
    // Clonar botones para limpiar eventos
    const newConfirm = btnConfirm.cloneNode(true);
    const newCancel = btnCancel.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);

    newCancel.onclick = () => { logoutApp(); };
    newConfirm.onclick = () => { modal.style.display = 'none'; startInactivityTimers(); };

    modal.style.display = 'flex';

    // Cuenta atrás
    let segundosRestantes = 300; // 5 minutos extra
    const countdownInterval = setInterval(() => {
        if(modal.style.display === 'none') { clearInterval(countdownInterval); return; }
        segundosRestantes--;
        const m = Math.floor(segundosRestantes / 60);
        const s = segundosRestantes % 60;
        const display = document.getElementById('logout-countdown');
        if(display) display.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        
        if (segundosRestantes <= 0) {
            clearInterval(countdownInterval); 
            modal.style.display = 'none';
            logoutApp();
        }
    }, 1000);
}

window.logoutApp = function() {
    localStorage.clear(); 
    window.location.href = 'index.html';
};

window.mostrarModalError = function(mensaje, onCloseAction) {
    const modal = document.getElementById('custom-modal');
    if(!modal) return; 
    const titleEl = document.getElementById('modal-title');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    titleEl.innerText = "Atenció"; titleEl.style.color = "var(--brand-blue)"; 
    document.getElementById('modal-msg').innerHTML = mensaje; 
    btnCancel.style.display = 'none'; 
    btnConfirm.innerText = "Entesos"; btnConfirm.style.background = "var(--brand-blue)"; btnConfirm.disabled = false;
    
    const newConfirm = btnConfirm.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    newConfirm.onclick = () => { modal.style.display = 'none'; if (onCloseAction) onCloseAction(); };
    modal.style.display = 'flex';
};

window.mostrarModalConfirmacion = function(titulo, mensaje, onConfirm) {
    const modal = document.getElementById('custom-modal');
    if(!modal) return; 
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-msg');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    titleEl.innerText = titulo; titleEl.style.color = "var(--brand-blue)"; msgEl.innerText = mensaje;
    btnConfirm.innerText = "Confirmar"; btnConfirm.disabled = false; btnCancel.style.display = "block"; 

    const newConfirm = btnConfirm.cloneNode(true); const newCancel = btnCancel.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);

    newConfirm.onclick = () => { if(onConfirm) onConfirm(); else modal.style.display = 'none'; };
    newCancel.onclick = () => { modal.style.display = 'none'; };
    modal.style.display = 'flex';
};

// ==========================================
// 3. UI Y EVENTOS
// ==========================================
function setupDirectClicks() {
    const btnBell = document.getElementById('btn-notifs');
    const btnMsg = document.getElementById('btn-messages');
    
    if (btnBell) btnBell.onclick = (e) => { e.stopPropagation(); abrirPanelNotificaciones(); };
    if (btnMsg) btnMsg.onclick = (e) => { e.stopPropagation(); abrirPanelMensajes(); };

    // Menú móvil
    const btnMobile = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('main-nav');
    if (btnMobile && navMenu) {
        btnMobile.onclick = (e) => { e.stopPropagation(); navMenu.classList.toggle('show-mobile'); };
    }

    // Menú Usuario
    const btnUser = document.getElementById('user-menu-trigger');
    const userDropdown = document.getElementById('user-dropdown-menu');
    if (btnUser && userDropdown) {
        btnUser.onclick = (e) => {
            e.stopPropagation();
            if (userDropdown.style.display === 'flex') { userDropdown.style.display = 'none'; userDropdown.classList.remove('show'); } 
            else { closeAllMenus(); userDropdown.style.display = 'flex'; userDropdown.classList.add('show'); }
        };
    }
    
    // Links Dropdown
    document.querySelectorAll('#user-dropdown-menu a').forEach(link => {
        link.onclick = (e) => {
            const action = link.getAttribute('data-action');
            if (action) { e.preventDefault(); window.showView(action); closeAllMenus(); } 
            else if (link.innerText.includes('Sortir')) { e.preventDefault(); window.logoutApp(); }
        };
    });
    
    // Cerrar al hacer clic fuera
    document.body.addEventListener('click', closeAllMenus);

    // Navegación header desktop
    const navButtons = [ { id: 'nav-catalog', view: 'home' }, { id: 'nav-profile', view: 'profile' }, { id: 'nav-dashboard', view: 'dashboard' } ];
    navButtons.forEach(btn => {
        const el = document.getElementById(btn.id);
        if (el) el.onclick = (e) => { e.preventDefault(); window.showView(btn.view); closeAllMenus(); };
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

// ==========================================
// 4. MOTOR DE NOTIFICACIONES (CORREGIDO)
// ==========================================

async function checkRealNotifications() {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    if (!user || !token) return;

    const bellDot = document.querySelector('.notification-dot');
    if(bellDot) bellDot.style.display = 'none'; 

    try {
        let totalCount = 0;

        // 1. Notificaciones de sistema no leídas
        const resNotif = await fetch(`${API_ROUTES.notifications}?filters[users_permissions_user][id][$eq]=${user.id}&filters[llegida][$eq]=false`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const jsonNotif = await resNotif.json();
        if (jsonNotif.data) totalCount += jsonNotif.data.length;

        // 2. Mensajes pendientes (si es profesor)
        if (user.es_professor === true) {
            const resMsg = await fetch(`${API_ROUTES.messages}?filters[estat][$eq]=pendent`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const jsonMsg = await resMsg.json();
            if (jsonMsg.data) totalCount += jsonMsg.data.length;
        }

        // Actualizar UI Campana
        if (bellDot) {
            if (totalCount > 0) {
                bellDot.style.display = 'flex';
                bellDot.classList.add('animate-ping');
                bellDot.innerText = totalCount > 9 ? '+9' : totalCount; 
            } else {
                bellDot.style.display = 'none';
                bellDot.classList.remove('animate-ping');
            }
        }
    } catch (e) {
        console.warn("Error checking notifications:", e);
    }
}

window.abrirPanelNotificaciones = async function() {
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-msg');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    // Resetear modal
    titleEl.innerText = "Notificacions"; 
    titleEl.style.color = "var(--brand-blue)";
    btnCancel.style.display = 'none'; 
    btnConfirm.innerText = "Tancar";
    
    const newConfirm = btnConfirm.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    newConfirm.onclick = () => modal.style.display = 'none';

    msgEl.innerHTML = '<div class="loader"></div>';
    modal.style.display = 'flex';

    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');

    try {
        let html = '<div class="notif-list">';
        let hasContent = false;

        // 1. Mensajes Profesor
        if (user.es_professor === true) {
            try {
                // Añadimos timestamp para evitar caché
                const ts = new Date().getTime();
                const resMsg = await fetch(`${API_ROUTES.messages}?filters[estat][$eq]=pendent&_t=${ts}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resMsg.ok) {
                    const jsonMsg = await resMsg.json();
                    const countMsg = jsonMsg.data ? jsonMsg.data.length : 0;
                    if (countMsg > 0) {
                        hasContent = true;
                        html += `
                            <div class="notif-item unread" onclick="document.querySelector('.notification-dot').style.display='none'; abrirPanelMensajes(); document.getElementById('custom-modal').style.display='none';">
                                <div class="notif-header">
                                    <span><i class="fa-solid fa-comment-dots"></i> Safata d'Entrada</span>
                                    <small style="color:var(--brand-red); font-weight:bold;">PENDENTS</small>
                                </div>
                                <strong class="notif-title">Tens ${countMsg} dubtes d'alumnes per respondre</strong>
                                <div class="notif-body">Fes clic aquí per anar a la safata de missatges.</div>
                            </div>`;
                    }
                }
            } catch (e) { console.warn("Error msg:", e); }
        }

        // 2. Notificaciones (SOLO NO LEÍDAS + ANTI-CACHE)
        try {
            // EL TRUCO: &timestamp=... obliga a traer datos frescos
            const ts = new Date().getTime();
            const res = await fetch(`${API_ROUTES.notifications}?filters[users_permissions_user][id][$eq]=${user.id}&filters[llegida][$eq]=false&sort=createdAt:desc&timestamp=${ts}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                const json = await res.json();
                const notifs = json.data || [];
                if (notifs.length > 0) {
                    hasContent = true;
                    notifs.forEach(n => {
                        const fecha = new Date(n.createdAt).toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });
                        // Usamos documentId si existe, sino id
                        const realId = n.documentId || n.id;
                        html += `
                            <div class="notif-item unread" onclick="marcarNotificacionLeida('${realId}', this)">
                                <div class="notif-header">
                                    <span><i class="fa-solid fa-envelope"></i> ${fecha}</span>
                                    <small style="color:var(--brand-red); font-weight:bold;">NOVA</small>
                                </div>
                                <strong class="notif-title">${n.titol}</strong>
                                <div class="notif-body">${n.missatge}</div>
                            </div>`;
                    });
                }
            }
        } catch (e) { console.warn("Error notif:", e); }

        html += '</div>';

        if (!hasContent) {
            msgEl.innerHTML = `<div style="text-align:center; padding:30px; color:#666;"><i class="fa-regular fa-bell-slash" style="font-size:2rem; margin-bottom:10px; opacity:0.5;"></i><p>No tens notificacions noves.</p></div>`;
        } else {
            msgEl.innerHTML = html;
        }

    } catch (e) {
        console.error(e);
        msgEl.innerHTML = '<p style="color:red; text-align:center;">Error carregant dades.</p>';
    }
};

/* ==========================================================================
   FIX JS: NOTIFICACIONES PERSISTENTES (Strapi v5 Compatible)
   Sustituye esto en js/dashboard.js
   ========================================================================== */

window.marcarNotificacionLeida = async function(id, element) {
    // 1. Ocultar visualmente de inmediato (UX Rápida)
    if (!element.classList.contains('unread')) return;
    
    element.style.opacity = '0.4';
    element.style.pointerEvents = 'none';
    element.classList.remove('unread');
    
    const badge = element.querySelector('small');
    if(badge) badge.remove();

    // Actualizar contador campana visualmente
    const bellDot = document.querySelector('.notification-dot');
    if (bellDot && bellDot.innerText) {
        let current = parseInt(bellDot.innerText);
        if (!isNaN(current) && current > 0) {
            current--;
            if (current === 0) bellDot.style.display = 'none';
            else bellDot.innerText = current > 9 ? '+9' : current;
        }
    }

    // 2. ENVIAR CAMBIO AL SERVIDOR
    const token = localStorage.getItem('jwt');
    
    // NOTA: Si 'id' es un número largo o string raro, es documentId (Strapi v5). 
    // Si es un número corto (1, 2, 3), es ID legacy. Intentamos ambos endpoint por seguridad.
    
    try {
        console.log(`Intentando marcar leída notif: ${id}`);
        
        // Intento Principal (Estándar Strapi)
        let response = await fetch(`${API_ROUTES.notifications}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ data: { llegida: true } })
        });

        // Si falla (ej: 404), podría ser porque Strapi espera documentId y tenemos ID o viceversa.
        if (!response.ok) {
            console.warn(`Fallo primer intento (${response.status}). Verificando permisos o ID...`);
            
            // Si da error 403 (Forbidden), es que el ROL Authenticated no tiene permiso 'update' en Notificaciones.
            // Esto solo se puede arreglar en el Panel de Admin de Strapi (Settings > Roles > Authenticated > Notificaciones > Update: Check).
            if (response.status === 403) {
                console.error("ERROR DE PERMISOS: El usuario no puede actualizar notificaciones.");
                // Revertimos visualmente para que sepa que falló
                element.style.opacity = '1';
                element.style.borderLeft = '4px solid red'; // Indicador de error visual
                alert("Error: No tienes permiso para marcar notificaciones. Contacta al admin.");
                return;
            }
        } else {
            console.log("Notificación marcada como leída correctamente en servidor.");
        }

        // 3. Limpieza final del DOM
        setTimeout(() => {
            element.style.display = 'none';
            // Comprobar si queda alguna visible
            const container = document.querySelector('.notif-list');
            if(container) {
                const visibles = Array.from(container.children).filter(c => c.style.display !== 'none');
                if (visibles.length === 0) {
                    const msgEl = document.getElementById('modal-msg');
                    if(msgEl) msgEl.innerHTML = `<div style="text-align:center; padding:30px; color:#666;"><i class="fa-regular fa-bell-slash" style="font-size:2rem; margin-bottom:10px; opacity:0.5;"></i><p>No tens notificacions noves.</p></div>`;
                }
            }
        }, 300);

    } catch (e) {
        console.error("Error de red al marcar notificacion:", e);
        element.style.opacity = '1'; 
    }
};

// ==========================================
// 5. MENSAJERÍA (WHATSAPP STYLE UI CORREGIDO)
// ==========================================

async function abrirPanelMensajes(modoForzado) {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'none'; // Reset limpio
    setTimeout(() => { modal.style.display = 'flex'; }, 50);

    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-msg');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');
    
    const user = JSON.parse(localStorage.getItem('user'));
    const esProfe = user.es_professor === true;
    let modoActual = modoForzado ? modoForzado : (esProfe ? 'profesor' : 'alumno');

    // Header del modal
    let headerHtml = "";
    if (esProfe) {
        if (modoActual === 'profesor') {
            headerHtml = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"><span>👨‍🏫 Safata (Profe)</span><button class="btn-small" onclick="abrirPanelMensajes('alumno')">Veure com Alumne</button></div>`;
        } else {
            headerHtml = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"><span>💬 Els meus Dubtes</span><button class="btn-small" onclick="abrirPanelMensajes('profesor')">Veure com Professor</button></div>`;
        }
        titleEl.innerHTML = headerHtml;
    } else {
        titleEl.innerText = "💬 Els meus Dubtes";
    }
    
    titleEl.style.color = "var(--brand-blue)";
    btnCancel.style.display = 'none';
    btnConfirm.innerText = "Tancar";
    
    const newConfirm = btnConfirm.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    newConfirm.onclick = () => modal.style.display = 'none';

    msgEl.innerHTML = '<div class="loader"></div><p style="text-align:center">Carregant...</p>';

    try {
        const token = localStorage.getItem('jwt');
        let endpoint = '';

        if (modoActual === 'profesor') {
            // Ver pendientes de responder, ordenados por antigüedad
            endpoint = `${API_ROUTES.messages}?filters[estat][$eq]=pendent&sort=createdAt:asc&populate=users_permissions_user`;
        } else {
            // Ver mis mensajes (alumno), ordenados cronológicamente
            endpoint = `${API_ROUTES.messages}?filters[users_permissions_user][id][$eq]=${user.id}&sort=createdAt:asc`;
        }

        const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        const mensajes = json.data || [];

        if (mensajes.length === 0) {
            msgEl.innerHTML = `<div style="text-align:center; padding:30px; color:#999;"><i class="fa-regular fa-comment-dots" style="font-size:3rem; margin-bottom:10px;"></i><p>No hi ha missatges.</p></div>`;
            return;
        }

        // GENERACIÓN DEL CHAT (CORREGIDO PUNTO 3)
        let html = '<div class="msg-list-container" id="chat-container">';
        
        mensajes.forEach(msg => {
            const fecha = new Date(msg.createdAt).toLocaleDateString('ca-ES', { 
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
            
            const alumnoId = msg.users_permissions_user ? (msg.users_permissions_user.id || msg.users_permissions_user.documentId) : null;
            const alumnoNombre = msg.alumne_nom || 'Alumne';
            
            const procesarTexto = (txt) => {
                if(!txt) return '';
                return txt.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>').replace(/\n/g, '<br>');
            };

            // Estructura de burbujas Flexbox
            let burbujasHtml = '';

            if (modoActual === 'profesor') {
                // VISTA PROFE:
                // Alumno (Izquierda / Blanco)
                burbujasHtml += `
                    <div class="chat-bubble bubble-student">
                        <strong>${alumnoNombre}</strong><br>
                        ${procesarTexto(msg.missatge)}
                        <span class="msg-date-small">${fecha}</span>
                    </div>
                `;
                
                // Área de respuesta (Profe)
                burbujasHtml += `
                    <div class="reply-area">
                        <textarea id="reply-${msg.documentId || msg.id}" placeholder="Escriu la resposta..." style="width:100%; border-radius:8px; padding:8px;"></textarea>
                        <button class="btn-primary" style="margin-top:5px; width:auto; padding:5px 15px; font-size:0.85rem;" 
                            onclick="enviarRespostaProfessor('${msg.documentId || msg.id}', ${alumnoId}, '${encodeURIComponent(msg.tema)}')">
                            <i class="fa-regular fa-paper-plane"></i> Enviar
                        </button>
                    </div>
                `;

            } else {
                // VISTA ALUMNO:
                // Yo (Derecha / Verde)
                burbujasHtml += `
                    <div class="chat-bubble bubble-teacher">
                        ${procesarTexto(msg.missatge)}
                        <span class="msg-date-small">${fecha}</span>
                    </div>
                `;

                // Respuesta Profe (Izquierda / Blanco)
                if (msg.resposta_professor) {
                    burbujasHtml += `
                        <div class="chat-bubble bubble-student">
                            <strong style="color:var(--brand-blue)">👨‍🏫 Professor:</strong><br>
                            ${procesarTexto(msg.resposta_professor)}
                        </div>
                    `;
                } else {
                    burbujasHtml += `<small style="align-self: flex-end; color:#999; font-size:0.7rem;">Enviat. Esperant resposta...</small>`;
                }
            }

            // Envoltorio Tarjeta (Separador por temas)
            html += `
                <div class="msg-card">
                    <div class="msg-course-badge"><i class="fa-solid fa-graduation-cap"></i> ${msg.curs} | ${msg.tema}</div>
                    <div class="msg-content">
                        ${burbujasHtml}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        msgEl.innerHTML = html;

        // Auto-scroll al fondo
        setTimeout(() => {
            const container = document.getElementById('chat-container');
            if(container) container.scrollTop = container.scrollHeight;
        }, 100);

    } catch (e) {
        console.error(e);
        msgEl.innerHTML = '<p style="color:red; text-align:center;">Error carregant missatges.</p>';
    }
}

window.enviarRespostaProfessor = async function(msgId, studentId, encodedTema) {
    const txtArea = document.getElementById(`reply-${msgId}`);
    const respuesta = txtArea.value.trim();
    if (!respuesta) return alert("Escriu una resposta.");

    const token = localStorage.getItem('jwt');
    const btn = txtArea.nextElementSibling;
    
    btn.innerText = "Enviant..."; 
    btn.disabled = true;

    try {
        const resMsg = await fetch(`${API_ROUTES.messages}/${msgId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                data: { 
                    resposta_professor: respuesta, 
                    estat: 'respost' 
                } 
            })
        });

        if (!resMsg.ok) throw new Error("Error actualitzant missatge");

        // Notificar al alumno
        if (studentId) {
            const tema = decodeURIComponent(encodedTema);
            const notifPayload = {
                data: {
                    titol: "Dubte Respost",
                    missatge: `El professor ha respost al teu dubte sobre: "${tema}".`,
                    llegida: false,
                    users_permissions_user: studentId 
                }
            };
            await fetch(API_ROUTES.notifications, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(notifPayload)
            });
        }
        
        document.getElementById('custom-modal').style.display = 'none';
        
        // Recargar para limpiar la lista
        setTimeout(() => {
            window.mostrarModalError("✅ Resposta enviada correctament.");
            checkRealNotifications(); // Actualizar contador
        }, 300);

    } catch (e) {
        console.error(e);
        document.getElementById('custom-modal').style.display = 'none';
        setTimeout(() => {
            window.mostrarModalError("❌ Error al processar la resposta. Comprova la connexió.");
        }, 300);
    }
};

// ==========================================
// 6. UTILIDADES FORMATO & CURSOS
// ==========================================

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

// Renderizado Cursos
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
            if(curs.imatge) { 
                const img = Array.isArray(curs.imatge) ? curs.imatge[0] : curs.imatge; 
                if(img?.url) imgUrl = img.url.startsWith('/') ? STRAPI_URL + img.url : img.url; 
            }

            const hoy = new Date();
            const fechaInicio = curs.fecha_inicio ? new Date(curs.fecha_inicio) : new Date(curs.publishedAt);
            const esFuturo = fechaInicio > hoy;
            const dateStr = fechaInicio.toLocaleDateString('ca-ES');

            let badgeOverlay = esFuturo 
                ? `<span class="course-badge" style="background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba;"><i class="fa-regular fa-calendar"></i> Properament: ${dateStr}</span>` 
                : (curs.etiqueta ? `<span class="course-badge">${curs.etiqueta}</span>` : '');
            
            let tagsHtml = '<div class="course-tags">';
            if (!esFuturo) tagsHtml += `<span class="tag tag-date"><i class="fa-solid fa-check"></i> Iniciat: ${dateStr}</span>`;
            if (curs._matricula && viewMode === 'home') tagsHtml += `<span class="tag tag-status"><i class="fa-solid fa-user-check"></i> Ja matriculat</span>`;
            tagsHtml += '</div>';

            const descHtml = generarHtmlDescripcion(curs.descripcio || curs.resum, index);
            const horasHtml = `<div class="course-hours"><i class="fa-regular fa-clock"></i> ${curs.hores ? curs.hores + ' Hores' : 'Durada no especificada'}</div>`;
            let actionHtml = '', progressHtml = '';

            if (curs._matricula) {
                const mat = curs._matricula;
                let porcentaje = mat.progres || 0;
                let isCompleted = mat.estat === 'completat' || porcentaje >= 100;
                
                if (mat.progres_detallat && mat.progres_detallat.examen_final && mat.progres_detallat.examen_final.aprobado) {
                    porcentaje = 100;
                    isCompleted = true;
                }

                const color = isCompleted ? '#10b981' : 'var(--brand-blue)';
                progressHtml = `<div class="progress-container"><div class="progress-bar"><div class="progress-fill" style="width:${porcentaje}%; background:${color}"></div></div><span class="progress-text">${porcentaje}% Completat</span></div>`;
                actionHtml = esFuturo ? `<button class="btn-primary" style="background-color:#ccc; cursor:not-allowed;" onclick="alertFechaFutura('${safeTitle}', '${dateStr}')">Accedir</button>` : `<a href="index.html?slug=${curs.slug}" class="btn-primary">Accedir</a>`;
            } else {
                actionHtml = `<button class="btn-enroll" onclick="window.solicitarMatricula('${cursId}', '${safeTitle}')">Matricular-me</button>`;
            }

            list.innerHTML += `<div class="course-card-item"><div class="card-image-header" style="background-image: url('${imgUrl}');">${badgeOverlay}</div><div class="card-body"><h3 class="course-title">${curs.titol}</h3>${horasHtml}${descHtml}${tagsHtml}${progressHtml}${actionHtml}</div></div>`;
        });
    } catch(e) { 
        console.error(e); 
        list.innerHTML = '<p style="color:red;">Error de connexió al carregar cursos.</p>'; 
    }
}

window.alertFechaFutura = function(titol, fecha) { 
    window.mostrarModalError(`El curs "${titol}" estarà disponible el ${fecha}. Encara no hi pots accedir.`); 
};

window.solicitarMatricula = function(courseId, courseTitle) {
    window.mostrarModalConfirmacion("Confirmar Matriculació", `Vols inscriure't al curs "${courseTitle}"?`, async () => {
        const btnConf = document.getElementById('modal-btn-confirm'); btnConf.innerText = "Processant..."; btnConf.disabled = true;
        try {
            const user = JSON.parse(localStorage.getItem('user')); const token = localStorage.getItem('jwt'); const now = new Date().toISOString();
            const payload = { data: { curs: courseId, users_permissions_user: Number(user.id), progres: 0, estat: 'actiu', data_inici: now, progres_detallat: {} } };
            const res = await fetch(`${STRAPI_URL}/api/matriculas`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
            if (res.ok) {
                document.getElementById('custom-modal').style.display = 'none';
                window.showView('dashboard'); 
                window.mostrarModalError("Matrícula realitzada correctament! Ja pots accedir al curs.");
            } else {
                const err = await res.json(); document.getElementById('custom-modal').style.display = 'none';
                setTimeout(() => window.mostrarModalError("Error al matricular: " + (err.error?.message || "Dades incorrectes (400)")), 200);
            }
        } catch (e) { 
            document.getElementById('custom-modal').style.display = 'none'; 
            setTimeout(() => window.mostrarModalError("Error de connexió."), 200); 
        }
    });
};

window.loadUserCourses = async function() { await renderCoursesLogic('dashboard'); };
window.loadCatalog = async function() { await renderCoursesLogic('home'); };

// ==========================================
// 7. PERFIL & CERTIFICADOS
// ==========================================
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

window.gradesCache = [];

async function loadGrades() {
    const tbody = document.getElementById('grades-table-body');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if(!tbody || !token) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;"><div class="loader"></div></td></tr>';

    try {
        const res = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate=curs.moduls`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const json = await res.json();
        tbody.innerHTML = '';
        window.gradesCache = [];

        if(!json.data || json.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No tens cursos matriculats.</td></tr>';
            return;
        }

        json.data.forEach((mat, index) => {
            const curs = mat.curs;
            if(!curs) return;

            window.gradesCache[index] = { matricula: mat, curso: curs };

            const isCompleted = mat.estat === 'completat' || mat.progres >= 100;
            const notaGlobal = mat.nota_final || (mat.progres_detallat?.examen_final?.nota) || '-';
            const statusColor = isCompleted ? '#10b981' : 'var(--brand-blue)';
            const statusText = isCompleted ? 'Completat' : `${mat.progres}%`;
            
            const diplomaHtml = isCompleted 
                ? `<button class="btn-small" onclick="callPrintDiploma(${index})"><i class="fa-solid fa-file-invoice"></i> Certificat</button>`
                : '<small style="color:#999;">Pendent</small>';

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 15px;"><strong>${curs.titol}</strong></td>
                    <td style="padding: 15px;"><span style="color:${statusColor}; font-weight:bold;">${statusText}</span></td>
                    <td style="padding: 15px; font-weight:bold;">${notaGlobal}</td>
                    <td style="padding: 15px;">${diplomaHtml}</td>
                </tr>
            `;
        });
    } catch(e) { 
        console.error(e); 
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error carregant qualificacions.</td></tr>'; 
    }
}

window.callPrintDiploma = function(index) {
    const data = window.gradesCache[index];
    if (data) {
        window.imprimirDiplomaCompleto(data.matricula, data.curso);
    } else {
        alert("Error al generar el diploma. Refresca la página.");
    }
};

window.imprimirDiplomaCompleto = function(matriculaData, cursoData) {
    const user = JSON.parse(localStorage.getItem('user'));
    const nombreAlumno = `${user.nombre || ''} ${user.apellidos || user.username}`.toUpperCase();
    const nombreCurso = cursoData.titol;
    const horas = cursoData.hores || 'N/A';
    const matriculaId = matriculaData.documentId || matriculaData.id;
    const nota = matriculaData.nota_final || matriculaData.progres_detallat?.examen_final?.nota || '10';

    const optionsDate = { year: 'numeric', month: 'long', day: 'numeric' };
    const fechaEmision = new Date().toLocaleDateString('ca-ES', optionsDate);
    
    let fechaInicioStr = "Unknown";
    let fechaFinStr = "Unknown";

    if (cursoData.fecha_inicio) {
        fechaInicioStr = new Date(cursoData.fecha_inicio).toLocaleDateString('ca-ES', { day: 'numeric', month: '2-digit', year: 'numeric' });
    } else if (cursoData.publishedAt) {
        fechaInicioStr = new Date(cursoData.publishedAt).toLocaleDateString('ca-ES', { day: 'numeric', month: '2-digit', year: 'numeric' });
    }

    if (cursoData.data_fi) {
        fechaFinStr = new Date(cursoData.data_fi).toLocaleDateString('ca-ES', { day: 'numeric', month: '2-digit', year: 'numeric' });
    } else {
        fechaFinStr = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: '2-digit', year: 'numeric' });
    }

    const textoFechasCurso = `Realitzat del ${fechaInicioStr} al ${fechaFinStr}`;
    const currentDomain = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const verifyUrl = `${currentDomain}/verify.html?ref=${matriculaId}`;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`;

    let modulosHtml = '';
    if (cursoData.moduls && cursoData.moduls.length > 0) {
        modulosHtml = '<ul>';
        cursoData.moduls.forEach((m, i) => {
            const tituloLimpio = m.titol.replace(/^(Mòdul|Modul|Módulo)\s*\d+[:\s-]*/i, "").trim();
            modulosHtml += `<li><strong>Mòdul ${i+1}:</strong> ${tituloLimpio}</li>`;
        });
        modulosHtml += '</ul>';
    } else {
        modulosHtml = '<p><em>Temari detallat segons l\'expedient acadèmic del curs.</em></p>';
    }

    let printContainer = document.getElementById('diploma-print-container');
    if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'diploma-print-container';
        document.body.appendChild(printContainer);
    }

    printContainer.innerHTML = `
        <div class="diploma-page">
            <div class="diploma-border-outer">
                <div class="diploma-border-inner">
                    <img src="img/logo-sicap.png" class="diploma-watermark">
                    <img src="img/logo-sicap.png" class="diploma-logo-top">
                    <h1 class="diploma-title">CERTIFICAT D'APROFITAMENT</h1>
                    <p class="diploma-text">El Sindicat Català de Presons (SICAP) certifica que</p>
                    <div class="diploma-student">${nombreAlumno}</div>
                    <p class="diploma-text">Amb DNI <strong>${user.username}</strong>, ha superat satisfactòriament el curs:</p>
                    <h2 class="diploma-course">${nombreCurso}</h2>
                    <div class="diploma-details">
                        <p class="diploma-text"><strong>${textoFechasCurso}</strong>, amb una durada de <strong>${horas} hores</strong> lectives.</p>
                        <p class="diploma-text">Qualificació obtinguda: <strong>${nota}</strong></p>
                        <p class="diploma-text" style="margin-top:20px; font-size:0.95rem;">Barcelona, ${fechaEmision}</p>
                    </div>
                    <div class="diploma-footer">
                        <div class="footer-qr-area"><img src="${qrSrc}" class="qr-image"><div class="qr-ref">Ref: ${matriculaId}</div></div>
                        <div class="footer-signature-area">
                            <img src="img/firma-miguel.png" class="signature-img" alt="Firma" onerror="this.style.display='none'">
                            <div class="signature-line"></div>
                            <span class="signature-name">Miguel Pueyo Pérez</span>
                            <span class="signature-role">Secretari General</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="diploma-page">
            <div class="diploma-border-outer">
                <div class="diploma-border-inner" style="align-items: flex-start; text-align: left; padding: 40px;">
                    <img src="img/logo-sicap.png" class="diploma-watermark">
                    <div class="page-back-content">
                        <div class="expedient-header"><h3 class="expedient-title">Expedient Formatiu</h3><img src="img/logo-sicap.png" style="height:30px; opacity:0.6;"></div>
                        <div class="info-grid">
                            <div class="info-item"><span>Alumne/a</span><strong>${nombreAlumno}</strong></div>
                            <div class="info-item"><span>DNI</span><strong>${user.username}</strong></div>
                            <div class="info-item"><span>Curs</span><strong>${nombreCurso}</strong></div>
                            <div class="info-item"><span>Dates</span><strong>${fechaInicioStr} - ${fechaFinStr}</strong></div>
                            <div class="info-item"><span>Hores</span><strong>${horas}h</strong></div>
                            <div class="info-item"><span>Qualificació</span><strong>${nota}</strong></div>
                        </div>
                        <h4 style="color:var(--brand-blue); border-bottom: 2px solid var(--brand-blue); padding-bottom:5px; margin-bottom:15px;">CONTINGUTS DEL CURS</h4>
                        <div class="modules-list">${modulosHtml}</div>
                        <div class="back-footer"><p style="margin:0;">SICAP - Sindicat Català de presons - Unitat de Formació</p></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    setTimeout(() => { window.print(); }, 800);
};