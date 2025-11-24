// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    // Referencias del DOM
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const errorMsg = document.getElementById('login-error-msg');
    
    // Inputs DNI
    const loginDniInput = document.getElementById('login-dni');
    const regDniInput = document.getElementById('reg-dni');
    
    // Vistas
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');

    // Botones
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');
    const btnLogout = document.getElementById('btn-logout');
    const userNameDisplay = document.getElementById('user-name-display');

    // --- 0. VALIDACIÓN DNI EN TIEMPO REAL ---
    // Esta función fuerza mayúsculas y quita guiones/puntos mientras escribes
    function setupDniInput(inputElement) {
        if (!inputElement) return;
        inputElement.addEventListener('input', (e) => {
            let val = e.target.value;
            // 1. Convertir a mayúsculas
            val = val.toUpperCase();
            // 2. Eliminar todo lo que NO sea número o letra (quita espacios, guiones, puntos)
            val = val.replace(/[^0-9A-Z]/g, '');
            // 3. Limitar a 9 caracteres visualmente
            if (val.length > 9) val = val.slice(0, 9);
            
            e.target.value = val;
        });
    }

    // Aplicamos la "mano dura" a los dos campos
    setupDniInput(loginDniInput);
    setupDniInput(regDniInput);

    // --- 1. CHEQUEO DE SESIÓN AL INICIAR ---
    const token = localStorage.getItem('jwt');
    const userData = JSON.parse(localStorage.getItem('user'));

    if (token && userData) {
        showCampus(userData);
    } else {
        showLogin();
    }

    // --- 2. NAVEGACIÓN ---
    if (btnShowRegister) {
        btnShowRegister.addEventListener('click', (e) => {
            e.preventDefault();
            hideError();
            loginView.style.display = 'none';
            registerView.style.display = 'block';
            // Copiar el DNI si ya lo había escrito en el login
            if(loginDniInput.value) regDniInput.value = loginDniInput.value;
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

    // --- 3. LOGIN ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const identifier = loginDniInput.value.trim();
        const password = document.getElementById('login-pass').value;
        const btnSubmit = loginForm.querySelector('button[type="submit"]');

        // VALIDACIÓN FORMATO DNI (8 números + 1 Letra)
        const dniRegex = /^\d{8}[A-Z]$/;
        if (!dniRegex.test(identifier)) {
            showError("El format del DNI no és correcte. Exemple: 12345678A");
            return;
        }

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
                showError('Usuari o contrasenya incorrectes.');
            }
        } catch (error) {
            console.error(error);
            showError('Error de connexió amb el servidor.');
        } finally {
            toggleLoading(btnSubmit, false, "Inicia la sessió");
        }
    });

    // --- 4. REGISTRO ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const dni = regDniInput.value.trim();
        const pass = document.getElementById('reg-pass').value;
        const passConf = document.getElementById('reg-pass-conf').value;
        const btnSubmit = registerForm.querySelector('button[type="submit"]');

        // VALIDACIÓN FORMATO DNI
        const dniRegex = /^\d{8}[A-Z]$/;
        if (!dniRegex.test(dni)) {
            showError("El format del DNI no és correcte. Exemple: 12345678A");
            return;
        }

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
            const checkUrl = `${API_ROUTES.checkAffiliate}?filters[dni][$eq]=${dni}`;
            const checkResp = await fetch(checkUrl);
            const checkData = await checkResp.json();
            const afiliados = checkData.data;

            if (!afiliados || afiliados.length === 0) {
                showError("Aquest DNI no consta com a afiliat actiu. Contacta amb SICAP.");
                toggleLoading(btnSubmit, false, "Validar i Entrar");
                return;
            }

            const afiliadoData = afiliados[0];
            const emailReal = afiliadoData.email;
            
            // CAPTURAMOS NOMBRE Y APELLIDOS DE LA BASE DE DATOS DE AFILIADOS
            const nombreReal = afiliadoData.nombre;
            const apellidosReal = afiliadoData.apellidos;

            toggleLoading(btnSubmit, true, "Creant compte...");

            const registerPayload = {
                username: dni,
                email: emailReal,
                password: pass,
                // AÑADIMOS ESTOS DOS CAMPOS NUEVOS
                nombre: nombreReal,
                apellidos: apellidosReal
            };

            const regResp = await fetch(API_ROUTES.register, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerPayload)
            });

            const regData = await regResp.json();

            if (regResp.ok) {
                saveSession(regData);
            } else {
                const apiError = regData.error?.message || "Error al registrar.";
                if (apiError.includes('email') || apiError.includes('username')) {
                    showError("Aquest usuari ja està registrat. Prova a fer Login.");
                } else {
                    showError("Error del servidor: " + apiError);
                }
            }

        } catch (error) {
            console.error(error);
            showError("Error tècnic.");
        } finally {
            if (!localStorage.getItem('jwt')) {
                toggleLoading(btnSubmit, false, "Validar i Entrar");
            }
        }
    });

    // 5. LOGOUT
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('jwt');
            localStorage.removeItem('user');
            window.location.href = window.location.pathname;
        });
    }

    // 6. FORGOT PASS
    const forgotLink = document.getElementById('forgot-pass');
    if(forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            alert("Funció en manteniment.\nContacta amb soporte@sicap.cat");
        });
    }

    // --- FUNCIONES AUXILIARES ---

    function showCampus(user) {
        loginOverlay.style.display = 'none'; 
        document.getElementById('app-container').style.display = 'block'; 
        if (userNameDisplay) userNameDisplay.innerText = user.username || user.email;

        // Cargar cursos con pequeño delay
        setTimeout(() => {
            if (typeof window.loadUserCourses === 'function') {
                window.loadUserCourses();
            }
        }, 200);
    }

    function showLogin() {
        loginOverlay.style.display = 'flex';
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