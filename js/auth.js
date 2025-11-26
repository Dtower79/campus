// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const errorMsg = document.getElementById('login-error-msg');

    // Navegación entre formularios
    if (btnShowRegister) {
        btnShowRegister.onclick = (e) => {
            e.preventDefault();
            loginView.style.display = 'none';
            registerView.style.display = 'block';
            if(errorMsg) errorMsg.style.display = 'none';
        };
    }

    if (btnShowLogin) {
        btnShowLogin.onclick = (e) => {
            e.preventDefault();
            registerView.style.display = 'none';
            loginView.style.display = 'block';
            if(errorMsg) errorMsg.style.display = 'none';
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
                    localStorage.setItem('jwt', data.jwt);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    document.getElementById('login-overlay').style.display = 'none';
                    document.getElementById('app-container').style.display = 'block';
                    if (window.iniciarApp) window.iniciarApp();
                    else window.location.reload();
                } else {
                    mostrarError("DNI o contrasenya incorrectes.");
                }
            } catch (error) {
                console.error(error);
                mostrarError("Error de connexió.");
            }
        };
    }

    // --- REGISTRO CON ESTRATEGIA "DOBLE SALTO" ---
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const dni = document.getElementById('reg-dni').value.trim().toUpperCase();
            const pass = document.getElementById('reg-pass').value;
            const passConf = document.getElementById('reg-pass-conf').value;

            if (pass !== passConf) { alert("Les contrasenyes no coincideixen."); return; }
            if (pass.length < 6) { alert("Mínim 6 caràcters."); return; }

            try {
                // PASO 0: Buscar datos del afiliado
                const resAfiliado = await fetch(`${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${dni}`);
                const jsonAfiliado = await resAfiliado.json();

                if (!jsonAfiliado.data || jsonAfiliado.data.length === 0) {
                    alert("Aquest DNI no consta com a afiliat actiu.");
                    return;
                }
                const datosAfiliado = jsonAfiliado.data[0];

                // PASO 1: REGISTRO LIMPIO (Solo datos estándar)
                const registerPayload = {
                    username: dni,
                    email: datosAfiliado.email || `${dni}@sicap.cat`,
                    password: pass
                };

                const resReg = await fetch(`${STRAPI_URL}/api/auth/local/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(registerPayload)
                });

                const dataReg = await resReg.json();

                if (dataReg.jwt) {
                    // ¡Usuario creado! Ahora tenemos el JWT.
                    // PASO 2: ACTUALIZAR PERFIL (Añadir Nombre y Apellidos)
                    const userId = dataReg.user.id;
                    const token = dataReg.jwt;

                    const updatePayload = {
                        nombre: datosAfiliado.nombre,
                        apellidos: datosAfiliado.apellidos
                        // No enviamos es_professor, se queda false por defecto en DB
                    };

                    await fetch(`${STRAPI_URL}/api/users/${userId}`, {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` // Usamos su nuevo token
                        },
                        body: JSON.stringify(updatePayload)
                    });

                    alert("Compte activat correctament! Ja pots entrar.");
                    window.location.reload(); 
                } else {
                    console.error(dataReg);
                    if(dataReg.error && dataReg.error.message === 'Email or Username are already taken') {
                        alert("Aquest usuari ja existeix.");
                    } else {
                        alert("Error: " + (dataReg.error?.message || "Error desconegut"));
                    }
                }

            } catch (error) {
                console.error(error);
                alert("Error de connexió.");
            }
        };
    }

    function mostrarError(msg) {
        if(errorMsg) {
            errorMsg.innerText = msg;
            errorMsg.style.display = 'block';
        } else {
            alert(msg);
        }
    }
});