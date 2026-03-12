/* js/ui-init.js */

// 1. Aplicar tema inmediatamente (lo que hacían las líneas 531-533)
const savedTheme = localStorage.getItem('theme');
if(savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);

    // 2. Lógica de vista si hay slug
    if (urlParams.get('slug')) { 
        const dv = document.getElementById('dashboard-view');
        const ev = document.getElementById('exam-view');
        if(dv) dv.style.display = 'none'; 
        if(ev) ev.style.display = 'flex'; 
    }

    // 3. Lógica del botón de tema
    const themeBtn = document.getElementById('theme-toggle'); 
    if (themeBtn) {
        const icon = themeBtn.querySelector('i');
        icon.className = localStorage.getItem('theme') === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        
        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const next = isDark ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next); 
            localStorage.setItem('theme', next);
            icon.className = next === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        });
    }
    // --- LÓGICA DE MODALES LEGALES (Sustituye a los onclick) ---
    const setupLegalModal = (btnId, modalId) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        if (btn && modal) {
            btn.onclick = (e) => {
                e.preventDefault();
                modal.style.display = 'flex';
            };
        }
    };

    setupLegalModal('btn-footer-avis', 'modal-avis');
    setupLegalModal('btn-footer-privacitat', 'modal-privacitat');
    setupLegalModal('btn-footer-cookies', 'modal-cookies');
    

});

// Lógica para abrir modales legales (cumpliendo CSP)
    ['avis', 'privacitat', 'cookies'].forEach(tipo => {
        const btn = document.getElementById(`btn-footer-${tipo}`);
        if (btn) {
            btn.onclick = (e) => {
                e.preventDefault();
                document.getElementById(`modal-${tipo}`).style.display = 'flex';
            };
        }
    });