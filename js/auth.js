// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    // --- REFERENCIAS DOM ---
    const loginOverlay = document.getElementById('login-overlay');
    const errorMsg = document.getElementById('login-error-msg');
    
    // Vistas
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');

    // Formularios
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // Botones Navegación
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');
    const btnLogout = document.getElementById('btn-logout');

    // --- 1. CHEQUEO DE SESIÓN INICIAL ---
    const token = localStorage.getItem('jwt');
    const userData = JSON.parse(localStorage.getItem('user'));

    if (token && userData) {
        showCampus(userData);
    } else {
        showLogin();
    }

    // --- 2. NAVEGACIÓN ENTRE LOGIN Y REGISTRO ---
    if (btnShowRegister) {
        btnShowRegister.addEventListener('click', (e) => {
            e.preventDefault();
            hideError();
            loginView.style.display = 'none';
            registerView.style.display = 'block';
            // Pre-rellenar DNI si lo habían escrito
            const dniVal = document.getElementById('login-dni').value;
            if(dniVal) document.getElementById('reg-dni').value = dniVal;
        });
    }

    if (btnShowLogin) {
        btnShowLogin.addEventListener('click', (e) => {
            e.preventDefault();
            hideError();
            registerView.style.display = 'none';
            loginView.style.display = 'block';
        });
    }

    // --- 3. LÓGICA DE LOGIN (Usuario Existente) ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const identifier = document.getElementById('login-dni').value.trim();
        const password = document.getElementById('login-pass').value;
        const btnSubmit = loginForm.querySelector('button[type="submit"]');

        toggleLoading(btnSubmit, true, "Iniciant...");

        try {
            const response = await fetch(API_ROUTES.login, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password }),
            });

            const data = await response.json();

            if (response.ok) {
                saveSession(data);
            } else {
                showError('Credencials incorrectes o compte no activat.');
            }
        } catch (error) {
            console.error(error);
            showError('Error de connexió amb el servidor.');
        } finally {
            toggleLoading(btnSubmit, false, "Inicia la sessió");
        }
    });

    // --- 4. LÓGICA DE REGISTRO (Nuevo Usuario) ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const dni = document.getElementById('reg-dni').value.trim().toUpperCase();
        const pass = document.getElementById('reg-pass').value;
        const passConf = document.getElementById('reg-pass-conf').value;
        const btnSubmit = registerForm.querySelector('button[type="submit"]');

        // Validaciones Locales
        if (pass !== passConf) {
            showError("Les contrasenyes no coincideixen.");
            return;
        }
        if (pass.length < 6) {
            showError("La contrasenya ha de tenir almenys 6 caràcters.");
            return;
        }

        toggleLoading(btnSubmit, true, "Verificant Afiliació...");

        try {
            // PASO A: Consultar si el DNI existe en la colección 'afiliados'
            // Strapi v5 filtering syntax
            const checkUrl = `${API_ROUTES.checkAffiliate}?filters[dni][$eq]=${dni}`;
            
            const checkResp = await fetch(checkUrl);
            const checkData = await checkResp.json();
            
            // En Strapi v5 la respuesta suele venir dentro de 'data' array
            const afiliados = checkData.data;

            if (!afiliados || afiliados.length === 0) {
                showError("Aquest DNI no consta com a afiliat actiu. Contacta amb SICAP.");
                toggleLoading(btnSubmit, false, "Validar i Entrar");
                return;
            }

            // Tenemos afiliado válido. Obtenemos su email real de la BD.
            const afiliadoData = afiliados[0]; // El primer resultado
            const emailReal = afiliadoData.email; 

            // PASO B: Crear el usuario en Strapi (Users-Permissions)
            toggleLoading(btnSubmit, true, "Creant compte...");

            const registerPayload = {
                username: dni,      // Usamos DNI como username
                email: emailReal,   // Email oficial del sindicato
                password: pass,
            };

            const regResp = await fetch(API_ROUTES.register, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerPayload)
            });

            const regData = await regResp.json();

            if (regResp.ok) {
                // Registro exitoso -> Login automático
                saveSession(regData);
            } else {
                // Manejo de errores de Strapi (ej: Email already taken)
                const apiError = regData.error?.message || "Error al registrar.";
                if (apiError.includes('email') || apiError.includes('username')) {
                    showError("Aquest usuari ja està registrat. Prova a fer Login.");
                } else {
                    showError("Error del servidor: " + apiError);
                }
            }

        } catch (error) {
            console.error(error);
            showError("Error tècnic. Torna-ho a provar més tard.");
        } finally {
            if (!localStorage.getItem('jwt')) { // Si no hemos logueado, restaurar botón
                toggleLoading(btnSubmit, false, "Validar i Entrar");
            }
        }
    });

    // --- 5. LOGOUT ---
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('jwt');
            localStorage.removeItem('user');
            // Recargar para limpiar estados
            window.location.href = window.location.pathname;
        });
    }

    // --- FUNCIONES AUXILIARES ---

    function showCampus(user) {
        loginOverlay.style.display = 'none'; 
        document.getElementById('app-container').style.display = 'block';
    }

    function showLogin() {
        loginOverlay.style.display = 'flex';
        // Asegurar que vemos el form de login, no el de registro
        loginView.style.display = 'block';
        registerView.style.display = 'none';
    }

    function saveSession(data) {
        localStorage.setItem('jwt', data.jwt);
        localStorage.setItem('user', JSON.stringify(data.user));
        showCampus(data.user);
    }

    function showError(message) {
        errorMsg.innerText = message;
        errorMsg.style.display = 'block';
        // Pequeña animación de shake si quisieras
    }

    function hideError() {
        errorMsg.style.display = 'none';
    }

    function toggleLoading(btn, isLoading, text) {
        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${text}`;
            btn.style.opacity = "0.7";
        } else {
            btn.disabled = false;
            btn.innerText = text;
            btn.style.opacity = "1";
        }
    }
});