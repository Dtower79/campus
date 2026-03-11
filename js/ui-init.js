/* js/ui-init.js - Lógica de UI y Tema */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuración del tema (Dark/Light)
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // 2. Lógica del Router al cargar (Slugs)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('slug')) {
        const dashView = document.getElementById('dashboard-view');
        const examView = document.getElementById('exam-view');
        if (dashView) dashView.style.display = 'none';
        if (examView) examView.style.display = 'flex';
    }

    // 3. Inicialización del botón de cambio de tema
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        const icon = themeBtn.querySelector('i');
        const current = localStorage.getItem('theme');
        icon.className = current === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';

        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const next = isDark ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            icon.className = next === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        });
    }
});