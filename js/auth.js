// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    // REFERENCIAS DOM
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const errorMsg = document.getElementById('login-error-msg');

    // TOGGLE VISTAS
    if (btnShowRegister) {
        btnShowRegister.onclick = (e) => {
            e.preventDefault();
            loginView.style.display = 'none';
            registerView.style.display = 'block';
            errorMsg.style.display = 'none';
        };
    }

    if (btnShowLogin) {
        btnShowLogin.onclick = (e) => {
            e.preventDefault();
            registerView.style.display = 'none';
            loginView.style.display = 'block';
            errorMsg.style.display = 'none';
        };
    }

    // LOGIN
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const dni = document.getElementById('login-dni').value.trim().toUpperCase();
            const pass = document.getElementById('login-pass').value;
            
            try {
                const res = await fetch(`${STRAPI_URL}/api/auth/local`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: dni, password: pass })
                });

                const data = await res.json();

                if (data.jwt) {
                    // Login correcto
                    localStorage.setItem('jwt', data.jwt);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // Ocultar login y lanzar app
                    document.getElementById('login-overlay').style.display = 'none';
                    document.getElementById('app-container').style.display = 'block';
                    
                    // Iniciar lógica dashboard
                    if (window.iniciarApp) window.iniciarApp();
                    else window.location.reload(); // Fallback por si acaso
                } else {
                    mostrarError("DNI o contrasenya incorrectes.");
                }
            } catch (error) {
                console.error(error);
                mostrarError("Error de connexió amb el servidor.");
            }
        };
    }

    // REGISTRO (Aquí estaba el problema, ahora solucionado)
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const dni = document.getElementById('reg-dni').value.trim().toUpperCase();
            const pass = document.getElementById('reg-pass').value;
            const passConf = document.getElementById('reg-pass-conf').value;

            if (pass !== passConf) {
                alert("Les contrasenyes no coincideixen.");
                return;
            }

            if (pass.length < 6) {
                alert("La contrasenya ha de tenir almenys 6 caràcters.");
                return;
            }

            // CAMBIO CLAVE: Primero buscamos los datos del afiliado para rellenar nombre/apellidos
            try {
                // 1. Buscar en Afiliados
                // NOTA: Esto requiere que el rol "Public" tenga permiso 'find' en Afiliado en Strapi
                const resAfiliado = await fetch(`${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${dni}`);
                const jsonAfiliado = await resAfiliado.json();

                if (!jsonAfiliado.data || jsonAfiliado.data.length === 0) {
                    alert("Aquest DNI no consta com a afiliado actiu.");
                    return;
                }

                const datosAfiliado = jsonAfiliado.data[0]; // Cogemos los datos reales (Miguel...)

                // 2. Registrar Usuario con los datos recuperados
                const payload = {
                    username: dni,
                    email: datosAfiliado.email || `${dni}@sicap.cat`, // Usamos su email real o uno falso si no tiene
                    password: pass,
                    // AQUÍ ES DONDE ARREGLAMOS EL ERROR "INVALID PARAMETERS":
                    nombre: datosAfiliado.nombre,
                    apellidos: datosAfiliado.apellidos,
                    es_professor: false // Por defecto nadie es profe al registrarse
                };

                const resReg = await fetch(`${STRAPI_URL}/api/auth/local/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const dataReg = await resReg.json();

                if (dataReg.jwt) {
                    alert("Compte activat correctament! Ja pots entrar.");
                    window.location.reload(); // Recargar para ir al login limpio
                } else {
                    console.error(dataReg);
                    // Mensaje de error amigable
                    if(dataReg.error && dataReg.error.message === 'Email or Username are already taken') {
                        alert("Aquest usuari ja està registrat. Prova a fer Login.");
                    } else {
                        alert("Error al registrar: " + (dataReg.error ? dataReg.error.message : "Error desconegut"));
                    }
                }

            } catch (error) {
                console.error(error);
                alert("Error de connexió. Revisa la teva internet.");
            }
        };
    }

    function mostrarError(msg) {
        errorMsg.innerText = msg;
        errorMsg.style.display = 'block';
        // Efecto vibración
        loginView.classList.add('shake');
        setTimeout(() => loginView.classList.remove('shake'), 500);
    }
});