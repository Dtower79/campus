document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('jwt')) {
        if (!window.appIniciada) {
            window.iniciarApp();
        }
    }
});

// NUEVO BLOQUE 1: Función para mostrar Modal Genérico
window.mostrarModalConfirmacion = function(titulo, mensaje, onConfirm) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-msg').innerText = mensaje;
    
    // Botones
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    // Restaurar estado inicial de botones
    btnConfirm.innerText = "Confirmar";
    btnCancel.style.display = "inline-block";

    // Limpiar eventos anteriores
    const newConfirm = btnConfirm.cloneNode(true);
    const newCancel = btnCancel.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);

    newConfirm.onclick = () => {
        modal.style.display = 'none';
        if(onConfirm) onConfirm();
    };
    newCancel.onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
};

// MODIFICADO BLOQUE 1: Logout con Modal
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

// NUEVO BLOQUE 1: Navegación sin recarga
window.tornarAlDashboard = function() {
    document.getElementById('exam-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';
    window.history.pushState({}, document.title, window.location.pathname);
    if(window.loadUserCourses) window.loadUserCourses();
    window.scrollTo(0,0);
};

window.appIniciada = false;

window.iniciarApp = function() {
    if (window.appIniciada) return;
    window.appIniciada = true;

    console.log("🚀 Iniciando SICAP App (Bloque 1+2 Refinado)...");

    try { initHeaderData(); } catch (e) { console.error("Error header:", e); }

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

function setupDirectClicks() {
    const btnBell = document.getElementById('btn-notifs');
    if (btnBell) btnBell.onclick = (e) => { 
        e.stopPropagation(); 
        window.mostrarModalConfirmacion("Novetats", "No tens noves notificacions al fòrum o cursos nous.", () => {});
        document.getElementById('modal-btn-cancel').style.display = 'none';
        document.getElementById('modal-btn-confirm').innerText = "D'acord";
    };

    const btnMsg = document.getElementById('btn-messages');
    if (btnMsg) btnMsg.onclick = (e) => { 
        e.stopPropagation(); 
        window.mostrarModalConfirmacion("Missatgeria", "El sistema de missatgeria estarà disponible properament.", () => {});
        document.getElementById('modal-btn-cancel').style.display = 'none';
        document.getElementById('modal-btn-confirm').innerText = "Entesos";
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

// HELPER: Generar HTML descripción con "Mostrar més"
function generarHtmlDescripcion(resum, idUnico) {
    if (!resum) return '';
    const MAX_CHARS = 100;
    if (resum.length <= MAX_CHARS) {
        return `<div class="course-desc-container"><p class="course-desc">${resum}</p></div>`;
    }
    return `
        <div class="course-desc-container">
            <p class="course-desc short" id="desc-${idUnico}">${resum}</p>
            <span class="read-more-link" onclick="toggleDesc('${idUnico}')">Mostrar més</span>
        </div>
    `;
}

// HELPER: Toggle descripción
window.toggleDesc = function(id) {
    const p = document.getElementById(`desc-${id}`);
    const btn = p.nextElementSibling;
    if (p.classList.contains('short')) {
        p.classList.remove('short');
        btn.innerText = 'Mostrar menys';
    } else {
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
        const resMat = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
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

        // ORDENACIÓN POR FECHA (Descendente)
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
            const cursId = curs.documentId || curs.id || index;
            let imgUrl = 'img/logo-sicap.png';
            if(curs.imatge) { 
                const img = Array.isArray(curs.imatge) ? curs.imatge[0] : curs.imatge; 
                if(img?.url) imgUrl = img.url.startsWith('/') ? STRAPI_URL + img.url : img.url; 
            }

            const hoy = new Date();
            // Lógica fecha_inicio (si no existe, usa publishedAt)
            const fechaInicio = curs.fecha_inicio ? new Date(curs.fecha_inicio) : new Date(curs.publishedAt);
            const esFuturo = fechaInicio && fechaInicio > hoy;
            
            let dateBadge = '';
            if (fechaInicio) {
                const dateStr = fechaInicio.toLocaleDateString('ca-ES');
                if (esFuturo) {
                    dateBadge = `<div class="badge-date badge-future"><i class="fa-regular fa-calendar"></i> Properament: ${dateStr}</div>`;
                } else {
                    dateBadge = `<div class="badge-date"><i class="fa-solid fa-check"></i> Iniciat: ${dateStr}</div>`;
                }
            }

            // HORAS: Ahora visibles SIEMPRE
            const horasHtml = `<div class="course-hours">
                <i class="fa-regular fa-clock"></i> ${curs.hores ? curs.hores + ' Hores' : 'Durada no especificada'}
            </div>`;

            // DESCRIPCIÓN: Ahora visible con "Mostrar més"
            const descHtml = generarHtmlDescripcion(curs.resum, cursId);

            let progressHtml = '';
            let btnAction = '';
            
            if (curs._matricula) {
                // MATRICULADO
                const mat = curs._matricula;
                const color = mat.progres >= 100 ? '#10b981' : 'var(--brand-blue)';
                progressHtml = `
                    <div class="progress-container">
                        <div class="progress-bar"><div class="progress-fill" style="width:${mat.progres||0}%; background:${color}"></div></div>
                        <span class="progress-text">${mat.progres||0}% Completat</span>
                    </div>`;

                if (esFuturo) {
                    btnAction = `<button class="btn-primary" style="background-color:#ccc; cursor:not-allowed;" onclick="alertFechaFutura('${curs.titol}', '${fechaInicio.toLocaleDateString('ca-ES')}')">Accedir</button>`;
                } else {
                    btnAction = `<a href="index.html?slug=${curs.slug}" class="btn-primary">Accedir</a>`;
                }
                if(viewMode === 'home') dateBadge += ` <span class="badge-role" style="background:#e3f2fd; color:#0d47a1;">Ja matriculat</span>`;
            } else {
                // NO MATRICULADO
                progressHtml = ``; 
                btnAction = `<button class="btn-enroll" onclick="window.solicitarMatricula('${cursId}', '${curs.titol}')">Matricular-me</button>`;
            }

            const card = `
                <div class="course-card-item">
                    <div class="card-image-header" style="background-image: url('${imgUrl}');">
                        ${curs.etiqueta ? `<span class="course-badge">${curs.etiqueta}</span>` : ''}
                    </div>
                    <div class="card-body">
                        <h3 class="course-title">${curs.titol}</h3>
                        ${horasHtml}
                        ${dateBadge}
                        ${descHtml}
                        ${progressHtml}
                        ${btnAction}
                    </div>
                </div>`;
            list.innerHTML += card;
        });

    } catch(e) { 
        console.error(e);
        list.innerHTML = '<p style="color:red;">Error de connexió al carregar cursos.</p>'; 
    }
}

async function loadUserCourses() { await renderCoursesLogic('dashboard'); }
async function loadCatalog() { await renderCoursesLogic('home'); }

window.alertFechaFutura = function(titol, fecha) {
    window.mostrarModalConfirmacion("Curs no iniciat", `El curs "${titol}" estarà disponible el ${fecha}.`, () => {});
    document.getElementById('modal-btn-cancel').style.display = 'none';
    document.getElementById('modal-btn-confirm').innerText = "Entesos";
};

window.solicitarMatricula = function(id, titol) {
    window.mostrarModalConfirmacion("Inscripció", `Vols inscriure't al curs "${titol}"?`, () => { alert("Sol·licitud enviada (Simulació). Contacta amb administració."); });
};

async function loadFullProfile() {
    console.log("📥 Cargando perfil...");
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    const emailIn = document.getElementById('prof-email');
    if(emailIn) emailIn.value = user.email || '-';

    try {
        const res = await fetch(`${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${user.username}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        if(json.data && json.data.length > 0) {
            const afi = json.data[0];
            const getVal = (key) => afi[key] || afi[key.charAt(0).toLowerCase() + key.slice(1)] || '-';
            const map = { 'prof-movil': 'TelefonoMobil', 'prof-prov': 'Provincia', 'prof-pob': 'Poblacion', 'prof-centre': 'CentroTrabajo', 'prof-cat': 'CategoriaProfesional', 'prof-dir': 'Direccion', 'prof-iban': 'IBAN' };
            for (const [domId, apiField] of Object.entries(map)) { const el = document.getElementById(domId); if(el) el.value = getVal(apiField); }
        }

        const resMat = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate=curs`, { headers: { 'Authorization': `Bearer ${token}` } });
        const jsonMat = await resMat.json();
        const matriculas = jsonMat.data || [];
        let iniciados = matriculas.length;
        let acabados = 0;
        let horasTotales = 0;

        matriculas.forEach(m => {
            const isCompleted = m.estat === 'completat' || m.progres >= 100;
            if (isCompleted) {
                acabados++;
                if (m.curs && m.curs.hores) {
                    const h = parseInt(m.curs.hores) || 0;
                    horasTotales += h;
                }
            }
        });

        document.getElementById('profile-stats-container').style.display = 'block';
        document.getElementById('stat-started').innerText = iniciados;
        document.getElementById('stat-finished').innerText = acabados;
        document.getElementById('stat-hours').innerText = horasTotales + 'h';
    } catch(e) { console.error("Error perfil:", e); }
}

async function loadGrades() {
    const tbody = document.getElementById('grades-table-body');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));
    if(!tbody || !token) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;"><div class="loader"></div></td></tr>';

    try {
        const query = `filters[users_permissions_user][id][$eq]=${user.id}&populate=curs`;
        const res = await fetch(`${STRAPI_URL}/api/matriculas?${query}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        tbody.innerHTML = ''; 
        if(!json.data || json.data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No tens cursos matriculats.</td></tr>'; return; }
        json.data.forEach(mat => {
            const curs = mat.curs;
            if(!curs) return;
            const isCompleted = mat.estat === 'completat' || mat.progres === 100;
            const statusHtml = isCompleted ? '<span style="color:#10b981; font-weight:bold;">Completat</span>' : '<span style="color:var(--brand-blue);">En Curs</span>';
            const nota = mat.nota_final !== undefined && mat.nota_final !== null ? mat.nota_final : '-';
            const diplomaHtml = isCompleted ? `<button class="btn-small" onclick="alert('Descàrrega de diploma properament')"><i class="fa-solid fa-download"></i> PDF</button>` : '<small style="color:#999;">Pendent</small>';
            const row = `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 15px;"><strong>${curs.titol}</strong></td><td style="padding: 15px;">${statusHtml}</td><td style="padding: 15px;">${nota}</td><td style="padding: 15px;">${diplomaHtml}</td></tr>`;
            tbody.innerHTML += row;
        });
    } catch(e) { console.error(e); tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error carregant qualificacions.</td></tr>'; }
}