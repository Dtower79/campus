/* ==========================================================================
   DASHBOARD.JS (v54.0 - FULL VERSION: DATES, MENU, CHAT & CERTIFICATES)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwt');
    if (token) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        if (!window.appIniciada) window.iniciarApp();
    }
    const scrollBtn = document.getElementById('scroll-top-btn');
    if(scrollBtn) {
        window.onscroll = () => { scrollBtn.style.display = (document.documentElement.scrollTop > 300) ? "flex" : "none"; };
        scrollBtn.onclick = () => window.scrollTo({top:0, behavior:'smooth'});
    }
});

window.appIniciada = false;
window.sesionLeidas = new Set(); 

window.iniciarApp = function() {
    window.appIniciada = true;
    
    // 1. Cargar datos usuario
    const user = JSON.parse(localStorage.getItem('user'));
    if(user) {
        let initials = user.nombre ? user.nombre.charAt(0) : user.username.substring(0, 1);
        if(user.apellidos) initials += user.apellidos.charAt(0);
        const initialsStr = initials.toUpperCase();
        
        const safeText = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };
        
        safeText('user-initials', initialsStr);
        safeText('dropdown-username', user.nombre ? `${user.nombre} ${user.apellidos}` : user.username);
        safeText('dropdown-email', user.email);
        safeText('profile-avatar-big', initialsStr);
        safeText('profile-name-display', user.nombre ? `${user.nombre} ${user.apellidos}` : user.username);
        safeText('profile-dni-display', user.username);
    }

    // 2. Configurar eventos y notificaciones
    setupDirectClicks();
    checkRealNotifications();
    setInterval(checkRealNotifications, 60000);

    // 3. Router inicial
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('slug')) {
        window.showView('dashboard');
    } else {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('exam-view').style.display = 'flex';
    }
};

window.showView = function(viewName) {
    // Parar vídeos
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => { const t = iframe.src; iframe.src = ''; iframe.src = t; });
    const html5Videos = document.querySelectorAll('video');
    html5Videos.forEach(video => { video.pause(); });

    // Ocultar todas las vistas
    ['catalog-view', 'dashboard-view', 'profile-view', 'grades-view', 'exam-view'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    // Mostrar vista seleccionada
    const map = { 'home': 'catalog-view', 'dashboard': 'dashboard-view', 'profile': 'profile-view', 'grades': 'grades-view', 'exam': 'exam-view' };
    const target = document.getElementById(map[viewName]);
    if(target) target.style.display = viewName === 'exam' ? 'flex' : 'block';

    // Activar menú navegación
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if(viewName === 'home') document.getElementById('nav-catalog')?.classList.add('active');
    if(viewName === 'dashboard') document.getElementById('nav-dashboard')?.classList.add('active');
    if(viewName === 'profile') document.getElementById('nav-profile')?.classList.add('active');

    // Cargar datos según vista
    if(viewName === 'dashboard') loadUserCourses();
    if(viewName === 'home') loadCatalog();
    if(viewName === 'profile') loadFullProfile();
    if(viewName === 'grades') loadGrades();
};

function setupDirectClicks() {
    document.getElementById('btn-notifs').onclick = (e) => { e.stopPropagation(); abrirPanelNotificaciones(); };
    document.getElementById('btn-messages').onclick = (e) => { e.stopPropagation(); abrirPanelMensajes(); };
    
    // Navegación
    const navs = {'nav-catalog': 'home', 'nav-profile': 'profile', 'nav-dashboard': 'dashboard'};
    for(const [id, view] of Object.entries(navs)) {
        const el = document.getElementById(id);
        if(el) el.onclick = (e) => { e.preventDefault(); window.showView(view); };
    }

    // --- FIX MENÚ USUARIO (SIMPLIFICADO) ---
    const btnUser = document.getElementById('user-menu-trigger');
    const userDropdown = document.getElementById('user-dropdown-menu');

    if (btnUser && userDropdown) {
        btnUser.onclick = (e) => {
            e.stopPropagation();
            const isVisible = userDropdown.style.display === 'flex';
            userDropdown.style.display = isVisible ? 'none' : 'flex';
            if (isVisible) userDropdown.classList.remove('show');
            else userDropdown.classList.add('show');
        };
        document.addEventListener('click', () => {
            userDropdown.style.display = 'none';
            userDropdown.classList.remove('show');
        });
        userDropdown.onclick = (e) => e.stopPropagation();

        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = (e) => { 
                e.preventDefault(); 
                userDropdown.style.display = 'none';
                window.showView(btn.getAttribute('data-action')); 
            };
        });
        
        const btnLogout = document.getElementById('btn-logout-dropdown');
        if(btnLogout) btnLogout.onclick = (e) => { 
            e.preventDefault(); 
            localStorage.clear(); 
            window.location.href = 'index.html'; 
        };
    }

    const btnMob = document.getElementById('mobile-menu-btn');
    const navMob = document.getElementById('main-nav');
    if(btnMob) btnMob.onclick = (e) => { e.stopPropagation(); navMob.classList.toggle('show-mobile'); };
}

// --- NOTIFICACIONES ---
async function checkRealNotifications() {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    const bellDot = document.querySelector('.notification-dot');
    if(!user || !token) return;

    try {
        let total = 0;
        const ts = new Date().getTime();
        
        const res = await fetch(`${API_ROUTES.notifications}?filters[users_permissions_user][id][$eq]=${user.id}&filters[llegida][$eq]=false&_t=${ts}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        const validNotifs = (json.data || []).filter(n => !window.sesionLeidas.has(n.documentId || n.id));
        total += validNotifs.length;

        if(user.es_professor === true) {
            const resMsg = await fetch(`${API_ROUTES.messages}?filters[estat][$eq]=pendent&_t=${ts}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const jsonMsg = await resMsg.json();
            const validMsgs = (jsonMsg.data || []).filter(m => !window.sesionLeidas.has(m.documentId || m.id));
            total += validMsgs.length;
        }

        if(bellDot) {
            if(total > 0) {
                bellDot.style.display = 'flex';
                bellDot.innerText = total > 9 ? '+9' : total;
                bellDot.classList.add('animate-ping');
            } else {
                bellDot.style.display = 'none';
                bellDot.classList.remove('animate-ping');
            }
        }
    } catch(e) { console.warn(e); }
}

window.abrirPanelNotificaciones = async function() {
    const modal = document.getElementById('custom-modal');
    const msg = document.getElementById('modal-msg');
    const btnC = document.getElementById('modal-btn-confirm');
    document.getElementById('modal-title').innerText = "Notificacions";
    document.getElementById('modal-title').style.color = "var(--brand-blue)";
    document.getElementById('modal-btn-cancel').style.display = 'none';
    btnC.innerText = "Tancar";
    
    const newBtn = btnC.cloneNode(true); btnC.parentNode.replaceChild(newBtn, btnC);
    newBtn.onclick = () => modal.style.display = 'none';
    
    msg.innerHTML = '<div class="loader"></div>';
    modal.style.display = 'flex';

    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');

    try {
        let html = '<div class="notif-list">';
        let hasContent = false;
        const ts = new Date().getTime();

        if(user.es_professor === true) {
             const resMsg = await fetch(`${API_ROUTES.messages}?filters[estat][$eq]=pendent&_t=${ts}`, { headers: { 'Authorization': `Bearer ${token}` } });
             const jsonMsg = await resMsg.json();
             const pendientesReales = (jsonMsg.data || []).filter(m => !window.sesionLeidas.has(m.documentId || m.id));
             
             if(pendientesReales.length > 0) {
                 hasContent = true;
                 html += `<div class="notif-item unread" onclick="openTeacherInbox(this)">
                            <strong style="color:var(--brand-red)">👨‍🏫 Safata Professor</strong>
                            <p>Tens ${pendientesReales.length} dubtes d'alumnes per respondre.</p>
                          </div>`;
             }
        }

        const res = await fetch(`${API_ROUTES.notifications}?filters[users_permissions_user][id][$eq]=${user.id}&filters[llegida][$eq]=false&sort=createdAt:desc&_t=${ts}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        const notifsReales = (json.data || []).filter(n => !window.sesionLeidas.has(n.documentId || n.id));

        if(notifsReales.length > 0) {
            hasContent = true;
            notifsReales.forEach(n => {
                const idReal = n.documentId || n.id;
                html += `<div class="notif-item unread" onclick="marcarLeida('${idReal}', this)">
                            <strong style="color:var(--brand-blue)">${n.titol}</strong><p>${n.missatge}</p>
                         </div>`;
            });
        }

        html += '</div>';
        if(!hasContent) msg.innerHTML = '<div style="text-align:center; padding:30px; color:#999;"><p>No tens notificacions noves.</p></div>';
        else msg.innerHTML = html;

    } catch(e) { msg.innerHTML = 'Error al carregar.'; }
};

window.marcarLeida = async function(id, el) {
    el.style.opacity = '0.5';
    el.style.pointerEvents = 'none';
    window.sesionLeidas.add(id);

    const token = localStorage.getItem('jwt');
    try {
        const res = await fetch(`${API_ROUTES.notifications}/${id}`, {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
            body: JSON.stringify({ data: { llegida: true } }) 
        });
        if(!res.ok) throw new Error("API Error");
        el.remove();
        
        const bellDot = document.querySelector('.notification-dot');
        if(bellDot) {
            let count = parseInt(bellDot.innerText) || 0;
            count = Math.max(0, count - 1);
            if(count === 0) bellDot.style.display = 'none';
            else bellDot.innerText = count > 9 ? '+9' : count;
        }
    } catch(e) { console.error(e); }
};

window.openTeacherInbox = function(element) {
    element.style.display = 'none';
    document.getElementById('custom-modal').style.display = 'none';
    abrirPanelMensajes('profesor');
};

// --- MENSAJERÍA / CHAT ---
window.abrirPanelMensajes = async function(modoForzado) {
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-msg');
    const btnC = document.getElementById('modal-btn-confirm');
    document.getElementById('modal-btn-cancel').style.display = 'none';

    const user = JSON.parse(localStorage.getItem('user'));
    const esProfe = user.es_professor === true;
    let modoActual = modoForzado ? modoForzado : (esProfe ? 'profesor' : 'alumno');

    if (esProfe) {
        titleEl.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                                <span>${modoActual === 'profesor' ? '👨‍🏫 Bústia Professor' : '💬 Els meus Dubtes'}</span>
                                <button class="btn-small" onclick="abrirPanelMensajes('${modoActual === 'profesor' ? 'alumno' : 'profesor'}')" style="font-size:0.75rem; padding:4px 8px;">
                                    ${modoActual === 'profesor' ? 'Veure com Alumne' : 'Veure com Professor'}
                                </button>
                             </div>`;
    } else {
        titleEl.innerText = "💬 Els meus Dubtes";
        titleEl.style.color = "var(--brand-blue)";
    }

    btnC.innerText = "Tancar";
    const newBtn = btnC.cloneNode(true);
    btnC.parentNode.replaceChild(newBtn, btnC);
    newBtn.onclick = () => modal.style.display = 'none';
    
    msgEl.innerHTML = '<div class="loader"></div>';
    modal.style.display = 'flex';
    
    const token = localStorage.getItem('jwt');

    try {
        let endpoint = '';
        const ts = new Date().getTime();
        
        if (modoActual === 'profesor') {
            endpoint = `${API_ROUTES.messages}?filters[estat][$eq]=pendent&sort=createdAt:asc&populate=users_permissions_user&_t=${ts}`;
        } else {
            endpoint = `${API_ROUTES.messages}?filters[users_permissions_user][id][$eq]=${user.id}&sort=createdAt:asc&_t=${ts}`;
        }

        const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        
        if(!json.data || json.data.length === 0) {
            msgEl.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:#999;">
                    <div style="background:#f5f5f5; width:80px; height:80px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 15px auto;">
                        <i class="fa-regular fa-comments" style="font-size:2.5rem; color:#ccc;"></i>
                    </div>
                    <h4>No hi ha missatges ${modoActual === 'profesor' ? 'pendents' : ''}</h4>
                </div>`;
        } else {
            let html = '<div class="msg-list-container" id="chat-container">';
            const mensajesFiltrados = json.data.filter(m => !window.sesionLeidas.has(m.documentId || m.id));

            if (mensajesFiltrados.length === 0) {
                 msgEl.innerHTML = '<div style="text-align:center; padding:20px;">Tot al dia! 🎉</div>';
                 return;
            }

            mensajesFiltrados.forEach(m => {
                const dateUser = new Date(m.createdAt).toLocaleDateString('ca-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
                const dateProfe = new Date(m.updatedAt).toLocaleDateString('ca-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
                const headerBadge = `<strong>${m.curs}</strong> | ${m.tema}`;
                
                if (modoActual === 'profesor') {
                    const alumnoNombre = m.alumne_nom || 'Alumne';
                    const alumnoId = m.users_permissions_user?.id || m.users_permissions_user?.documentId;
                    
                    html += `
                        <div class="msg-card" id="msg-card-${m.documentId||m.id}">
                            <div class="msg-course-badge">${headerBadge}</div>
                            <div class="msg-content">
                                <div class="chat-bubble bubble-student">
                                    <strong>👤 ${alumnoNombre}</strong><br>
                                    ${m.missatge}
                                    <span class="msg-date-small">${dateUser}</span>
                                </div>
                                <div class="reply-area">
                                    <textarea id="reply-${m.documentId||m.id}" class="modal-textarea" placeholder="Escriu la resposta..." style="height:80px;"></textarea>
                                    <button class="btn-primary" style="margin-top:5px; padding:5px 15px; font-size:0.85rem;" 
                                        onclick="enviarRespostaProfessor('${m.documentId||m.id}', '${alumnoId}', '${encodeURIComponent(m.tema)}')">
                                        Enviar Resposta
                                    </button>
                                </div>
                            </div>
                        </div>`;
                } else {
                    html += `
                        <div class="msg-card">
                            <div class="msg-course-badge">${headerBadge}</div>
                            <div class="msg-content">
                                <div class="chat-bubble bubble-teacher">
                                    ${m.missatge}
                                    <span class="msg-date-small">${dateUser}</span>
                                </div>
                                ${m.resposta_professor ? `
                                    <div class="chat-bubble bubble-student">
                                        <strong style="color:var(--brand-blue)">👨‍🏫 Professor:</strong><br>
                                        ${m.resposta_professor}
                                        <span class="msg-date-small" style="margin-top:5px;">${dateProfe}</span>
                                    </div>` : 
                                    '<small style="text-align:right; color:#999; font-size:0.75rem;">Esperant resposta...</small>'
                                }
                            </div>
                        </div>`;
                }
            });
            html += '</div>';
            msgEl.innerHTML = html;
            requestAnimationFrame(() => {
                const c = document.getElementById('chat-container');
                if(c) { c.scrollTop = c.scrollHeight; setTimeout(() => c.scrollTop = c.scrollHeight, 150); }
            });
        }
    } catch(e) { msgEl.innerHTML = '<p style="color:red; text-align:center;">Error carregant missatges.</p>'; }
};

window.enviarRespostaProfessor = async function(msgId, studentId, encodedTema) {
    const txt = document.getElementById(`reply-${msgId}`);
    const respuesta = txt.value.trim();
    if(!respuesta) return alert("Escriu una resposta.");
    
    const token = localStorage.getItem('jwt');
    const btn = txt.nextElementSibling;
    btn.innerText = "Enviant..."; btn.disabled = true;

    window.sesionLeidas.add(msgId);

    try {
        await fetch(`${API_ROUTES.messages}/${msgId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ data: { resposta_professor: respuesta, estat: 'respost' } })
        });
        const card = document.getElementById(`msg-card-${msgId}`);
        if(card) card.remove();

        if(studentId && studentId !== 'undefined') {
            const tema = decodeURIComponent(encodedTema);
            await fetch(API_ROUTES.notifications, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    data: {
                        titol: "Dubte Respost",
                        missatge: `El professor ha respost al teu dubte sobre: "${tema}".`,
                        llegida: false,
                        users_permissions_user: studentId
                    }
                })
            });
        }
        checkRealNotifications();
    } catch(e) {
        alert("Error al enviar la resposta.");
        btn.innerText = "Enviar Resposta"; btn.disabled = false;
        window.sesionLeidas.delete(msgId);
    }
};

// --- CARGA DE DATOS Y CURSOS ---
window.loadUserCourses = async function() { await renderCoursesLogic('dashboard'); };
window.loadCatalog = async function() { await renderCoursesLogic('home'); };

async function renderCoursesLogic(viewMode) {
    const listId = viewMode === 'dashboard' ? 'courses-list' : 'catalog-list';
    const list = document.getElementById(listId);
    if(!list) return;
    
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));
    list.innerHTML = '<div class="loader"></div>';

    try {
    const ts = new Date().getTime();
    const resMat = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge&_t=${ts}`, { headers: { 'Authorization': `Bearer ${token}` } });
    
    // --- BLOQUE DE SEGURIDAD AÑADIDO ---
    if (resMat.status === 401 || resMat.status === 403) {
        // Si Strapi dice "No autorizado", es que el token caducó.
        localStorage.clear(); // Borramos la llave vieja
        window.location.reload(); // Recargamos para que salga el Login
        return;
    }
    // -----------------------------------

    const jsonMat = await resMat.json();
            
        let cursosAMostrar = [];

        if (viewMode === 'dashboard') {
            cursosAMostrar = userMatriculas.map(m => ({ ...m.curs, _matricula: m }));
        } else {
            const resCat = await fetch(`${STRAPI_URL}/api/cursos?populate=imatge&_t=${ts}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const jsonCat = await resCat.json();
            cursosAMostrar = jsonCat.data.map(c => {
                const existingMat = userMatriculas.find(m => (m.curs.documentId || m.curs.id) === (c.documentId || c.id));
                return { ...c, _matricula: existingMat };
            });
        }

        cursosAMostrar.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        list.innerHTML = '';
        if(cursosAMostrar.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding:20px; width:100%;">No hi ha cursos disponibles.</p>';
            return;
        }

        cursosAMostrar.forEach((curs) => {
            const cursId = curs.documentId || curs.id;
            const safeTitle = curs.titol.replace(/'/g, "\\'");
            let imgUrl = 'img/logo-sicap.png';
            if(curs.imatge) {
                const img = Array.isArray(curs.imatge) ? curs.imatge[0] : curs.imatge;
                if(img?.url) imgUrl = img.url.startsWith('/') ? STRAPI_URL + img.url : img.url;
            }

            // FIX FECHAS
            const rawInicio = curs.fecha_inicio || curs.data_inici || curs.publishedAt;
            const hoy = new Date();
            const fechaInicio = new Date(rawInicio);
            const esFuturo = fechaInicio > hoy;
            const dateStr = fechaInicio.toLocaleDateString('ca-ES');

            let badge = esFuturo 
                ? `<span class="course-badge" style="background:#fff3cd; color:#856404; border:1px solid #ffeeba;">Properament: ${dateStr}</span>` 
                : (curs.etiqueta ? `<span class="course-badge">${curs.etiqueta}</span>` : '');

            let descHtml = '';
            if (curs.descripcio && typeof curs.descripcio === 'string') {
                 descHtml = `<div class="course-desc-container"><p class="course-desc short">${curs.descripcio.substring(0, 100)}...</p></div>`;
            }

            const horasHtml = `<div class="course-hours"><i class="fa-regular fa-clock"></i> ${curs.hores ? curs.hores + ' Hores' : 'N/A'}</div>`;
            
            let actionHtml = '', progressHtml = '';

            if (curs._matricula) {
                const mat = curs._matricula;
                let pct = mat.progres || 0;
                if(mat.progres_detallat?.examen_final?.aprobado) { pct = 100; }
                
                const color = pct >= 100 ? '#10b981' : 'var(--brand-blue)';
                progressHtml = `<div class="progress-container"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%; background:${color}"></div></div><span class="progress-text">${pct}% Completat</span></div>`;
                
                actionHtml = esFuturo 
                    ? `<button class="btn-primary" style="background-color:#ccc; cursor:pointer;" onclick="window.mostrarModalError('Aquest curs estarà disponible per accedir a partir del dia <strong>${dateStr}</strong>.')">Inicia el ${dateStr}</button>` 
                    : `<a href="index.html?slug=${curs.slug}" class="btn-primary">Accedir</a>`;
            } else {
                actionHtml = `<button class="btn-enroll" onclick="window.solicitarMatricula('${cursId}', '${safeTitle}')">Matricular-me</button>`;
            }

            list.innerHTML += `
                <div class="course-card-item">
                    <div class="card-image-header" style="background-image: url('${imgUrl}');">${badge}</div>
                    <div class="card-body">
                        <h3 class="course-title">${curs.titol}</h3>
                        ${horasHtml}
                        ${descHtml}
                        ${progressHtml}
                        ${actionHtml}
                    </div>
                </div>`;
        });
    } catch(e) { console.error(e); }
}

window.solicitarMatricula = function(id, title) {
    window.mostrarModalConfirmacion("Matrícula", `Vols inscriure't a "${title}"?`, async () => {
        const user = JSON.parse(localStorage.getItem('user'));
        const token = localStorage.getItem('jwt');
        try {
            const res = await fetch(`${STRAPI_URL}/api/matriculas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ data: { curs: id, users_permissions_user: user.id, progres: 0, estat: 'actiu', data_inici: new Date().toISOString(), progres_detallat: {} } })
            });
            if (!res.ok) throw new Error("Error API");

            try {
                await fetch(API_ROUTES.notifications, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ data: { titol: "Matrícula Realitzada", missatge: `T'has inscrit al curs: "${title}".`, llegida: false, users_permissions_user: user.id } })
                });
            } catch(e) {}
            window.location.reload();
        } catch(e) { alert("Error al matricular."); }
    });
};

async function loadFullProfile() {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    const emailInput = document.getElementById('prof-email');
    if(emailInput) emailInput.value = user.email;

    try {
        const resAfi = await fetch(`${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${user.username}`, { headers: { 'Authorization': `Bearer ${token}` }});
        const jsonAfi = await resAfi.json();
        if(jsonAfi.data && jsonAfi.data.length > 0) {
            const afi = jsonAfi.data[0];
            const map = { 'prof-movil': 'TelefonoMobil', 'prof-prov': 'Provincia', 'prof-pob': 'Poblacion', 'prof-centre': 'CentroTrabajo', 'prof-cat': 'CategoriaProfesional', 'prof-dir': 'Direccion', 'prof-iban': 'IBAN' };
            for(const [id, key] of Object.entries(map)) {
                const el = document.getElementById(id);
                if(el && afi[key]) {
                    el.value = afi[key];
                    el.style.cursor = "copy";
                    el.title = "Copiar";
                    el.onclick = () => navigator.clipboard.writeText(el.value);
                }
            }
        }
        
        const resMat = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate=curs`, { headers: { 'Authorization': `Bearer ${token}` }});
        const jsonMat = await resMat.json();
        let started = 0, finished = 0, hours = 0;
        jsonMat.data.forEach(m => {
            started++;
            if(m.estat === 'completat' || m.progres >= 100 || m.progres_detallat?.examen_final?.aprobado) {
                finished++;
                if(m.curs && m.curs.hores) hours += parseInt(m.curs.hores);
            }
        });
        document.getElementById('profile-stats-container').style.display = 'block';
        document.getElementById('stat-started').innerText = started;
        document.getElementById('stat-finished').innerText = finished;
        document.getElementById('stat-hours').innerText = hours + 'h';

    } catch(e) { console.error(e); }
}

async function loadGrades() {
    const tbody = document.getElementById('grades-table-body');
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4"><div class="loader"></div></td></tr>';

    try {
        const res = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate=curs.moduls`, { headers: { 'Authorization': `Bearer ${token}` }});
        const json = await res.json();
        tbody.innerHTML = '';
        window.gradesCache = [];

        if(json.data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Sense qualificacions.</td></tr>'; return; }

        json.data.forEach((mat, idx) => {
            const curs = mat.curs;
            window.gradesCache[idx] = { matricula: mat, curso: curs };
            
            const isDone = mat.estat === 'completat' || mat.progres >= 100 || mat.progres_detallat?.examen_final?.aprobado;
            const nota = mat.nota_final || mat.progres_detallat?.examen_final?.nota || '-';
            const color = isDone ? '#10b981' : 'var(--brand-blue)';
            
            let btnCert = '<small>Pendent</small>';
            
            if (isDone) {
                const hoy = new Date();
                const rawFin = curs.fecha_fin || curs.data_fi;
                const fechaFin = rawFin ? new Date(rawFin) : null;
                
                if (fechaFin && hoy <= fechaFin) {
                    const fechaStr = fechaFin.toLocaleDateString('ca-ES');
                    btnCert = `<small style="color:#d97706; font-weight:bold;">Disponible el ${fechaStr}</small>`;
                } else {
                    btnCert = `<button class="btn-small" onclick="window.callPrintDiploma(${idx})"><i class="fa-solid fa-file-invoice"></i> Certificat</button>`;
                }
            }

            tbody.innerHTML += `
                <tr style="border-bottom:1px solid #eee;">
                    <td data-label="Curs" style="padding:15px;"><strong>${curs.titol}</strong></td>
                    <td data-label="Estat" style="padding:15px; color:${color}; font-weight:bold;">${isDone ? 'Completat' : mat.progres+'%'}</td>
                    <td data-label="Nota" style="padding:15px;">${nota}</td>
                    <td data-label="Diploma" style="padding:15px;">${btnCert}</td>
                </tr>`;
        });
    } catch(e) { tbody.innerHTML = '<tr><td colspan="4">Error.</td></tr>'; }
}

window.callPrintDiploma = function(idx) {
    const data = window.gradesCache[idx];
    if(data) window.imprimirDiplomaCompleto(data.matricula, data.curso);
};

window.imprimirDiplomaCompleto = function(matriculaData, cursoData) {
    const user = JSON.parse(localStorage.getItem('user'));
    const nombreAlumno = `${user.nombre || ''} ${user.apellidos || user.username}`.toUpperCase();
    const nombreCurso = cursoData.titol;
    const horas = cursoData.hores || 'N/A';
    const matId = matriculaData.documentId || matriculaData.id;
    const nota = matriculaData.nota_final || matriculaData.progres_detallat?.examen_final?.nota || 'APTE';
    
    // FIX FECHAS DIPLOMA
    const rawInicio = cursoData.fecha_inicio || cursoData.data_inici || cursoData.publishedAt;
    const dataInici = rawInicio ? new Date(rawInicio).toLocaleDateString('ca-ES') : 'N/A';
    const rawFin = cursoData.fecha_fin || cursoData.data_fi;
    const dataFi = rawFin ? new Date(rawFin).toLocaleDateString('ca-ES') : 'N/A';
    const fechaHoy = new Date().toLocaleDateString('ca-ES', { year:'numeric', month:'long', day:'numeric' });
    
    const currentDomain = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentDomain + '/verify.html?ref=' + matId)}`;

    let temarioHtml = '';
    if(cursoData.moduls && cursoData.moduls.length > 0) {
        temarioHtml = '<ul style="margin:0; padding-left:20px;">' + cursoData.moduls.map((m,i) => `<li style="margin-bottom:5px;"><strong>Mòdul ${i+1}:</strong> ${m.titol}</li>`).join('') + '</ul>';
    } else {
        temarioHtml = '<p>Temari complet segons pla formatiu.</p>';
    }

    let printDiv = document.getElementById('diploma-print-container');
    if(!printDiv) {
        printDiv = document.createElement('div');
        printDiv.id = 'diploma-print-container';
        document.body.appendChild(printDiv);
    }

    printDiv.innerHTML = `
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
                        <p class="diploma-text">Amb una durada de <strong>${horas} hores</strong> lectives.</p>
                        <p class="diploma-text">Qualificació: <strong>${nota}</strong></p>
                        <p class="diploma-text" style="margin-top:20px; font-size:0.95rem;">Barcelona, ${fechaHoy}</p>
                    </div>
                    <div class="diploma-footer">
                        <div class="footer-qr-area"><img src="${qrSrc}" class="qr-image"><div class="qr-ref">Ref: ${matId}</div></div>
                        <div class="footer-signature-area">
                            <img src="img/firma-miguel.png" style="height: 100px; display: block; margin: 0 auto 0px auto; position: relative; z-index: 10;">
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
                <div class="diploma-border-inner" style="align-items:flex-start; text-align:left; padding:40px;">
                    <img src="img/logo-sicap.png" class="diploma-watermark">
                    <div style="width:100%; position:relative; z-index:2;">
                        <div style="display:flex; justify-content:space-between; width:100%; border-bottom:2px solid var(--brand-blue); margin-bottom:20px; padding-bottom:10px;">
                            <h3 style="margin:0; color:var(--brand-blue); text-transform:uppercase;">Expedient Formatiu</h3>
                            <img src="img/logo-sicap.png" style="height:30px; opacity:0.6;">
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:30px; padding:15px; border:1px solid #eee; border-radius:8px;">
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Alumne</span><strong style="font-size:1rem;">${nombreAlumno}</strong></div>
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Document Identitat</span><strong style="font-size:1rem;">${user.username}</strong></div>
                            <div style="grid-column:span 2;"><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Activitat Formativa</span><strong style="font-size:1rem;">${nombreCurso}</strong></div>
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Data Inici</span><strong style="font-size:1rem;">${dataInici}</strong></div>
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Data Finalització</span><strong style="font-size:1rem;">${dataFi}</strong></div>
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Durada</span><strong style="font-size:1rem;">${horas} Hores</strong></div>
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Data Expedició</span><strong style="font-size:1rem;">${fechaHoy}</strong></div>
                        </div>
                        <h4 style="color:var(--brand-blue); border-bottom:1px solid #ccc; padding-bottom:5px; margin-bottom:15px; text-transform:uppercase;">Continguts (Temari)</h4>
                        <div style="font-size:0.9rem; line-height:1.6;">${temarioHtml}</div>
                    </div>
                    <div style="position:absolute; bottom:20px; left:0; width:100%; text-align:center; font-size:0.8rem; color:#666; border-top:1px solid #eee; padding-top:10px;">
                        SICAP - Sindicat Català de Presons - Unitat de Formació
                    </div>
                </div>
            </div>
        </div>`;
    
    setTimeout(() => window.print(), 500);
};

window.mostrarModalError = function(msg) {
    const m = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = "Informació";
    document.getElementById('modal-title').style.color = "var(--brand-blue)";
    document.getElementById('modal-msg').innerHTML = msg;
    document.getElementById('modal-btn-cancel').style.display = 'none';
    const btn = document.getElementById('modal-btn-confirm');
    btn.innerText = "D'acord";
    const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = () => m.style.display = 'none';
    m.style.display = 'flex';
};

window.mostrarModalConfirmacion = function(titulo, msg, callback) {
    const m = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-msg').innerHTML = msg;
    document.getElementById('modal-btn-cancel').style.display = 'block';
    const btn = document.getElementById('modal-btn-confirm');
    btn.innerText = "Confirmar";
    const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn);
    const btnC = document.getElementById('modal-btn-cancel');
    const newBtnC = btnC.cloneNode(true); btnC.parentNode.replaceChild(newBtnC, btnC);
    
    newBtn.onclick = () => { m.style.display = 'none'; callback(); };
    newBtnC.onclick = () => m.style.display = 'none';
    m.style.display = 'flex';
};