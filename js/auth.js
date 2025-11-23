// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    // Referencias del DOM
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const errorMsg = document.getElementById('login-error-msg');
    const btnRegister = document.getElementById('btn-show-register');
    const btnLogout = document.getElementById('btn-logout');
    const userNameDisplay = document.getElementById('user-name-display');

    // 1. CHEQUEO DE SESIÓN AL INICIAR
    // Si ya tiene el token guardado, quitamos el login y mostramos el campus
    const token = localStorage.getItem('jwt');
    const userData = JSON.parse(localStorage.getItem('user'));

    if (token && userData) {
        showCampus(userData);
    } else {
        showLogin();
    }

    // 2. FUNCIÓN LOGIN (Usuario ya registrado)
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const identifier = document.getElementById('login-dni').value.trim(); // DNI o Email
        const password = document.getElementById('login-pass').value;
        const btnSubmit = loginForm.querySelector('button[type="submit"]');

        // Modo Carga
        const originalBtnText = btnSubmit.innerText;
        btnSubmit.innerText = "Verificant...";
        btnSubmit.disabled = true;

        try {
            const response = await fetch(API_ROUTES.login, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // GUARDAR SESIÓN
                localStorage.setItem('jwt', data.jwt);
                localStorage.setItem('user', JSON.stringify(data.user));
                showCampus(data.user);
            } else {
                showError('Usuari o contrasenya incorrectes.');
            }
        } catch (error) {
            showError('Error de connexió amb el servidor.');
            console.error(error);
        } finally {
            btnSubmit.innerText = originalBtnText;
            btnSubmit.disabled = false;
        }
    });

    // 3. FUNCIÓN LOGOUT (Cerrar Sesión)
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('jwt');
            localStorage.removeItem('user');
            showLogin();
        });
    }

    // 4. LÓGICA DE REGISTRO (El "Gatekeeper")
    // Al hacer clic en "Registra't aquí", cambiamos el formulario
    if (btnRegister) {
        btnRegister.addEventListener('click', (e) => {
            e.preventDefault();
            // Aquí lanzaremos la lógica de comprobar DNI (Lo implementaremos en el siguiente paso para no saturar)
            alert("Funció de registre en procés d'implementació. Primer fem funcionar el Login normal.");
        });
    }

    // --- FUNCIONES AUXILIARES ---

    function showCampus(user) {
        loginOverlay.style.display = 'none'; // Ocultar login
        document.getElementById('app-container').style.display = 'block'; // Mostrar campus
        if (userNameDisplay) userNameDisplay.innerText = user.username || user.email;
    }

    function showLogin() {
        loginOverlay.style.display = 'flex'; // Mostrar login
        // document.getElementById('app-container').style.display = 'none'; // Opcional: Ocultar fondo
    }

    function showError(message) {
        errorMsg.innerText = message;
        errorMsg.style.display = 'block';
    }

    function hideError() {
        errorMsg.style.display = 'none';
    }
});