// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // Intentamos iniciar si hay sesión
    if (localStorage.getItem('jwt')) {
        window.iniciarApp();
    }
});

// --- FUNCIÓN DE SALIDA (GLOBAL Y FORZADA) ---
window.logoutApp = function() {
    console.log("Cerrando sesión...");
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    localStorage.clear(); // Limpieza total
    // Redirección forzada a la raíz
    window.location.href = 'index.html';
};

// --- FUNCIÓN MAESTRA DE INICIO ---
window.iniciarApp = function() {
    // 1. Inicializar Cabecera
    initHeader();
    
    // 2. Router básico: Si estamos en index.html sin parámetros, mostrar dashboard o home
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('slug')) {
        // Por defecto mostramos Mis Cursos
        document.getElementById('dashboard-view').style.display = 'block';
        document.getElementById('catalog-view').style.display = 'none';
        document.getElementById('profile-view').style.display = 'none';
        loadUserCourses();
    }
};

function initHeader() {
    const userJson = localStorage.getItem('user');
    if (!userJson) return;
    
    let user;
    try { user = JSON.parse(userJson); } catch(e) { logoutApp(); return; }

    // Iniciales
    let initials = "US";
    if (user.username) initials = user.username.substring(0, 2).toUpperCase();
    if (user.nombre) initials = (user.nombre.charAt(0) + (user.apellidos ? user.apellidos.charAt(0) : '')).toUpperCase();
    
    const els = {
        initials: document.getElementById('user-initials'),
        dropName: document.getElementById('dropdown-username'),
        dropEmail: document.getElementById('dropdown-email')
    };
    
    if (els.initials) els.initials.innerText = initials;
    if (els.dropName) els.dropName.innerText = user.nombre ? `${user.nombre} ${user.apellidos}` : user.username;
    if (els.dropEmail) els.dropEmail.innerText = user.email;

    // Dropdown
    const trigger = document.getElementById('user-menu-trigger');
    const menu = document.getElementById('user-dropdown-menu');
    
    if (trigger && menu) {
        // Clonamos para limpiar eventos viejos
        const newTrigger = trigger.cloneNode(true);
        trigger.parentNode.replaceChild(newTrigger, trigger);
        
        newTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
        });
        
        // Cerrar al clicar fuera
        document.addEventListener('click', (e) => {
            if (!newTrigger.contains(e.target)) menu.classList.remove('show');
        });
    }
}

window.loadUserCourses = async function() {
    const list = document.getElementById('courses-list');
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));

    if(!list || !token || !user) return;
    list.innerHTML = '<div class="loader"></div>';

    try {
        const query = `filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge`;
        const url = `${STRAPI_URL}/api/matriculas?${query}`;
        
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Error API');
        const json = await response.json();
        
        list.innerHTML = '';
        if(!json.data || json.data.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding:20px;">No tens cursos actius.</p>';
            return;
        }

        json.data.forEach(mat => {
            const curs = mat.curs; 
            if(!curs) return;
            
            let imgUrl = 'img/logo-sicap.png';
            if(curs.imatge) {
                const imgData = Array.isArray(curs.imatge) ? curs.imatge[0] : curs.imatge;
                if (imgData && imgData.url) {
                    imgUrl = imgData.url.startsWith('/') ? `${STRAPI_URL}${imgData.url}` : imgData.url;
                }
            }

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
    } catch(e) { 
        console.error(e); 
        list.innerHTML = '<p style="color:red">Error de connexió.</p>'; 
    }
};

// Funciones placeholder para que no de error el router
window.showView = function(v) { console.log("Navegando a", v); }
window.loadCatalog = async function() {}
window.loadFullProfile = async function() {}
window.loadGrades = async function() {}