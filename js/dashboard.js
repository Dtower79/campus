document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('jwt')) {
        const overlay = document.getElementById('login-overlay');
        const app = document.getElementById('app-container');
        if (overlay) overlay.style.display = 'none';
        if (app) app.style.display = 'block';
        if (!window.appIniciada) window.iniciarApp();
    }
    
    // Gestión "He oblidat la contrasenya"
    const forgotLink = document.getElementById('forgot-pass');
    if(forgotLink) {
        forgotLink.onclick = (e) => {
            e.preventDefault();
            window.mostrarModalError("S'ha enviat un correu de recuperació a la teva adreça d'afiliació.");
        }
    }

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

let warningTimer;
let logoutTimer;
const WARNING_TIME = 10 * 60 * 1000; 

function startInactivityTimers() {
    if(!localStorage.getItem('jwt')) return;
    clearTimeout(warningTimer);
    clearTimeout(logoutTimer);
    warningTimer = setTimeout(() => { mostrarModalInactividad(); }, WARNING_TIME);
}

function resetInactivity() {
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    if (modal && modal.style.display === 'flex' && titleEl && titleEl.innerText === "Inactivitat Detectada") return; 
    startInactivityTimers();
}

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
    
    const newConfirm = btnConfirm.cloneNode(true);
    const newCancel = btnCancel.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);

    newCancel.onclick = () => { logoutApp(); };
    newConfirm.onclick = () => { modal.style.display = 'none'; startInactivityTimers(); };

    modal.style.display = 'flex';

    let segundosRestantes = 300;
    const countdownInterval = setInterval(() => {
        if(modal.style.display === 'none') { clearInterval(countdownInterval); return; }
        segundosRestantes--;
        const m = Math.floor(segundosRestantes / 60);
        const s = segundosRestantes % 60;
        const display = document.getElementById('logout-countdown');
        if(display) display.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        if (segundosRestantes <= 0) {
            clearInterval(countdownInterval); modal.style.display = 'none';
            localStorage.clear(); window.location.href = 'index.html';
        }
    }, 1000);
}

['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => { document.addEventListener(evt, resetInactivity); });

window.mostrarModalConfirmacion = function(titulo, mensaje, onConfirm) {
    const modal = document.getElementById('custom-modal');
    if(!modal) return; 
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-msg');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    titleEl.innerText = titulo; titleEl.style.color = "var(--brand-blue)"; msgEl.innerText = mensaje;
    btnConfirm.innerText = "Confirmar"; btnConfirm.disabled = false; btnConfirm.style.background = ""; btnCancel.style.display = "block"; 

    const newConfirm = btnConfirm.cloneNode(true); const newCancel = btnCancel.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);

    newConfirm.onclick = () => { if(onConfirm) onConfirm(); else modal.style.display = 'none'; };
    newCancel.onclick = () => { modal.style.display = 'none'; };
    modal.style.display = 'flex';
};

window.mostrarModalError = function(mensaje, onCloseAction) {
    const modal = document.getElementById('custom-modal');
    if(!modal) return; 
    const titleEl = document.getElementById('modal-title');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    titleEl.innerText = "Atenció"; titleEl.style.color = "var(--brand-blue)"; 
    document.getElementById('modal-msg').innerText = mensaje;
    btnCancel.style.display = 'none'; 
    btnConfirm.innerText = "Entesos"; btnConfirm.style.background = "var(--brand-blue)"; btnConfirm.disabled = false;
    
    const newConfirm = btnConfirm.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    newConfirm.onclick = () => { modal.style.display = 'none'; if (onCloseAction) onCloseAction(); };
    modal.style.display = 'flex';
};

window.logoutApp = function() {
    window.mostrarModalConfirmacion("Tancar Sessió", "Estàs segur que vols sortir del campus?", () => {
        localStorage.clear(); window.location.href = 'index.html';
    });
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
    console.log("🚀 SICAP App: Iniciant sistema...");
    
    startInactivityTimers();
    try { initHeaderData(); } catch (e) { console.error("Error header:", e); }
    
    checkRealNotifications(); 
    setInterval(checkRealNotifications, 60000);

    setTimeout(() => { setupDirectClicks(); }, 100);

    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('slug')) { window.showView('dashboard'); } 
    else { document.getElementById('dashboard-view').style.display = 'none'; document.getElementById('exam-view').style.display = 'flex'; }
};

function setupDirectClicks() {
    const btnBell = document.getElementById('btn-notifs');
    const btnMsg = document.getElementById('btn-messages');
    if (btnBell) btnBell.onclick = (e) => { e.stopPropagation(); abrirPanelNotificaciones(); };
    if (btnMsg) btnMsg.onclick = (e) => { e.stopPropagation(); abrirPanelMensajes(); };

    const btnMobile = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('main-nav');
    if (btnMobile && navMenu) {
        btnMobile.onclick = (e) => { e.stopPropagation(); navMenu.classList.toggle('show-mobile'); };
    }

    const btnUser = document.getElementById('user-menu-trigger');
    const userDropdown = document.getElementById('user-dropdown-menu');
    if (btnUser && userDropdown) {
        btnUser.onclick = (e) => {
            e.stopPropagation();
            if (userDropdown.style.display === 'flex') { userDropdown.style.display = 'none'; userDropdown.classList.remove('show'); } 
            else { closeAllMenus(); userDropdown.style.display = 'flex'; userDropdown.classList.add('show'); }
        };
    }
    
    const links = document.querySelectorAll('#user-dropdown-menu a');
    links.forEach(link => {
        link.onclick = (e) => {
            const action = link.getAttribute('data-action');
            if (action) { e.preventDefault(); window.showView(action); closeAllMenus(); } 
            else if (link.id === 'btn-logout-dropdown' || link.innerText.includes('Sortir')) { e.preventDefault(); window.logoutApp(); }
        };
    });
    document.body.addEventListener('click', closeAllMenus);

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
// 4. MOTOR DE NOTIFICACIONES (CORREGIDO PUNTOS 1 y 5)
// ==========================================

async function checkRealNotifications() {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    if (!user || !token) return;

    // PUNTO 1: Aseguramos que empiece oculto por CSS, aquí solo lo mostramos si hay algo
    const bellDot = document.querySelector('.notification-dot');
    if(bellDot) bellDot.style.display = 'none'; 

    try {
        let totalCount = 0;

        // 1. Notificaciones normales (para todos)
        const resNotif = await fetch(`${API_ROUTES.notifications}?filters[users_permissions_user][id][$eq]=${user.id}&filters[llegida][$eq]=false`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const jsonNotif = await resNotif.json();
        if (jsonNotif.data) totalCount += jsonNotif.data.length;

        // 2. PUNTO 5: Si es profesor, sumar también mensajes pendientes
        if (user.es_professor === true) {
            const resMsg = await fetch(`${API_ROUTES.messages}?filters[estat][$eq]=pendent`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const jsonMsg = await resMsg.json();
            if (jsonMsg.data) totalCount += jsonMsg.data.length;
        }

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

    titleEl.innerText = "Notificacions"; titleEl.style.color = "var(--brand-blue)";
    btnCancel.style.display = 'none'; btnConfirm.innerText = "Tancar";
    
    const newConfirm = btnConfirm.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    newConfirm.onclick = () => modal.style.display = 'none';

    msgEl.innerHTML = '<div class="loader"></div>';
    modal.style.display = 'flex';

    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');

    try {
        const res = await fetch(`${API_ROUTES.notifications}?filters[users_permissions_user][id][$eq]=${user.id}&sort=createdAt:desc&pagination[limit]=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        const notifs = json.data || [];

        if (notifs.length === 0) {
            msgEl.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">No tens notificacions.</p>';
            return;
        }

        let html = '<div class="notif-list">';
        notifs.forEach(n => {
            const fecha = new Date(n.createdAt).toLocaleDateString('ca-ES', { 
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' 
            });
            const unreadClass = n.llegida ? '' : 'unread';
            const icon = n.llegida ? '<i class="fa-regular fa-envelope-open"></i>' : '<i class="fa-solid fa-envelope"></i>';
            
            html += `
                <div class="notif-item ${unreadClass}" onclick="marcarNotificacionLeida('${n.documentId || n.id}', this)">
                    <div class="notif-header">
                        <span>${icon} ${fecha}</span>
                        ${!n.llegida ? '<small style="color:var(--brand-red); font-weight:bold;">NOVA</small>' : ''}
                    </div>
                    <strong class="notif-title">${n.titol}</strong>
                    <div class="notif-body">${n.missatge}</div>
                </div>
            `;
        });
        html += '</div>';
        msgEl.innerHTML = html;

    } catch (e) {
        msgEl.innerHTML = '<p style="color:red">Error carregant notificacions.</p>';
    }
};

window.marcarNotificacionLeida = async function(id, element) {
    if (!element.classList.contains('unread')) return; 
    const token = localStorage.getItem('jwt');
    try {
        await fetch(`${API_ROUTES.notifications}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ data: { llegida: true } })
        });
        element.classList.remove('unread');
        const badge = element.querySelector('small');
        if(badge) badge.remove();
        checkRealNotifications();
    } catch (e) { console.error("Error marking read:", e); }
};

// ==========================================
// 5. MENSAJERÍA (CORREGIDO PUNTOS 2 y 6)
// ==========================================

async function abrirPanelMensajes() {
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-msg');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');
    
    const user = JSON.parse(localStorage.getItem('user'));
    const esProfe = user.es_professor === true;

    titleEl.innerText = esProfe ? "👨‍🏫 Safata de Dubtes (Professor)" : "💬 Els meus Dubtes";
    titleEl.style.color = "var(--brand-blue)";
    btnCancel.style.display = 'none';
    btnConfirm.innerText = "Tancar";
    
    const newConfirm = btnConfirm.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    newConfirm.onclick = () => modal.style.display = 'none';

    msgEl.innerHTML = '<div class="loader"></div><p style="text-align:center">Carregant missatges...</p>';
    modal.style.display = 'flex';

    try {
        const token = localStorage.getItem('jwt');
        let endpoint = '';

        // PUNTO 2: CAMBIAMOS 'desc' por 'asc' para tener lo antiguo arriba y lo nuevo abajo
        if (esProfe) {
            endpoint = `${API_ROUTES.messages}?filters[estat][$eq]=pendent&sort=createdAt:asc&populate=users_permissions_user`;
        } else {
            endpoint = `${API_ROUTES.messages}?filters[users_permissions_user][id][$eq]=${user.id}&sort=createdAt:asc`;
        }

        const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        const mensajes = json.data || [];

        if (mensajes.length === 0) {
            msgEl.innerHTML = `<div style="text-align:center; padding:30px;">
                <i class="fa-regular fa-comment-dots" style="font-size:3rem; color:#ccc; margin-bottom:10px;"></i>
                <p>${esProfe ? 'No hi ha dubtes pendents! 🎉' : 'No has enviat cap dubte.'}</p>
            </div>`;
            return;
        }

        let html = '<div class="msg-list-container" id="chat-container">';
        mensajes.forEach(msg => {
            // FECHA COMPLETA
            const fecha = new Date(msg.createdAt).toLocaleDateString('ca-ES', { 
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
            });
            const alumnoId = msg.users_permissions_user ? (msg.users_permissions_user.id || msg.users_permissions_user.documentId) : null;
            
            // Función helper para enlaces (solución parcial punto 6)
            const procesarTexto = (txt) => {
                if(!txt) return '';
                // Convertir URLs en enlaces
                return txt.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:var(--brand-blue); text-decoration:underline;">$1</a>');
            };

            if (esProfe) {
                html += `
                    <div class="msg-card" style="border-left: 4px solid var(--brand-red);">
                        <div class="msg-header">
                            <span><strong>${msg.alumne_nom || 'Alumne'}</strong> - ${msg.curs}</span>
                            <span>${fecha}</span>
                        </div>
                        <div class="chat-meta">Tema: ${msg.tema}</div>
                        <div class="chat-bubble bubble-student">
                            ${procesarTexto(msg.missatge)}
                        </div>
                        
                        <div class="reply-area">
                            <textarea id="reply-${msg.documentId || msg.id}" placeholder="Escriu la resposta aquí... (Pots enganxar enllaços)"></textarea>
                            <button class="btn-small" style="background:var(--brand-blue); color:white; width:100%; justify-content:center;" 
                                onclick="enviarRespostaProfessor('${msg.documentId || msg.id}', ${alumnoId}, '${encodeURIComponent(msg.tema)}')">
                                <i class="fa-regular fa-paper-plane"></i> Enviar i Notificar
                            </button>
                        </div>
                    </div>
                `;
            } else {
                const estadoClass = msg.estat === 'pendent' ? 'status-pending' : 'status-replied';
                const estadoTexto = msg.estat === 'pendent' ? 'Pendent' : 'Respost';
                
                let respuestaHtml = '';
                if (msg.resposta_professor) {
                    respuestaHtml = `
                        <div class="chat-meta" style="text-align:right; margin-top:10px;">👨‍🏫 Professor:</div>
                        <div class="chat-bubble bubble-teacher">${procesarTexto(msg.resposta_professor)}</div>
                    `;
                }

                html += `
                    <div class="msg-card">
                        <div class="msg-header">
                            <span>${msg.curs} <span class="msg-date-small">${fecha}</span></span>
                            <span class="msg-status-badge ${estadoClass}">${estadoTexto}</span>
                        </div>
                        <div class="chat-bubble bubble-student">${procesarTexto(msg.missatge)}</div>
                        ${respuestaHtml}
                    </div>
                `;
            }
        });
        html += '</div>';
        msgEl.innerHTML = html;

        // PUNTO 2: SCROLL AUTOMÁTICO AL FONDO
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
    const originalText = btn.innerHTML;
    btn.innerText = "Enviant..."; btn.disabled = true;

    try {
        const resMsg = await fetch(`${API_ROUTES.messages}/${msgId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ data: { respuesta_professor: respuesta, estat: 'respost' } })
        });

        if (!resMsg.ok) throw new Error("Error actualitzant missatge");

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
        abrirPanelMensajes();
        window.mostrarModalError("Resposta enviada i alumne notificat correctament.");
    } catch (e) {
        console.error(e);
        alert("Error al processar la resposta.");
        btn.innerHTML = originalText; btn.disabled = false;
    }
};