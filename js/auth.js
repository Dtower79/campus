document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const errorMsg = document.getElementById('login-error-msg');

    // NAVEGACIÓN
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

    // PUNTO 2: DNI FORMATO (Sin espacios y mayúsculas)
    const inputsDNI = [document.getElementById('login-dni'), document.getElementById('reg-dni')];
    inputsDNI.forEach(input => {
        if(input) {
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\s/g, '').toUpperCase();
            });
        }
    });

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
                    // PUNTO 2: Mensaje bonito en lugar de alert o texto feo
                    mostrarError("DNI o contrasenya incorrectes.");
                }
            } catch (error) {
                console.error(error);
                mostrarError("Error de connexió amb el servidor.");
            }
        };
    }

    // REGISTRO
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const btnSubmit = registerForm.querySelector('button[type="submit"]');
            const originalText = btnSubmit.innerText;
            btnSubmit.innerText = "Validant...";
            btnSubmit.disabled = true;

            const dni = document.getElementById('reg-dni').value.trim().toUpperCase();
            const pass = document.getElementById('reg-pass').value;
            const passConf = document.getElementById('reg-pass-conf').value;

            const resetBtn = () => {
                btnSubmit.innerText = originalText;
                btnSubmit.disabled = false;
            };

            // PUNTO 2: Validaciones con Modal
            if (pass !== passConf) { 
                // Usamos la función global definida en dashboard.js si está cargada, o fallback
                window.mostrarModalError ? window.mostrarModalError("Les contrasenyes no coincideixen.") : alert("Les contrasenyes no coincideixen.");
                resetBtn(); return; 
            }
            if (pass.length < 6) { 
                window.mostrarModalError ? window.mostrarModalError("La contrasenya ha de tenir mínim 6 caràcters.") : alert("Mínim 6 caràcters.");
                resetBtn(); return; 
            }

            try {
                // 1. Buscar Afiliado
                const resAfiliado = await fetch(`${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${dni}`);
                const jsonAfiliado = await resAfiliado.json();

                if (!jsonAfiliado.data || jsonAfiliado.data.length === 0) {
                    // PUNTO 2: MENSAJE "NO AFILIADO" BONITO
                    if(window.mostrarModalError) {
                        window.mostrarModalError("Aquest DNI no consta com a afiliat actiu al SICAP. Contacta amb secretaria.");
                    } else {
                        alert("Aquest DNI no consta com a afiliat actiu.");
                    }
                    resetBtn();
                    return;
                }
                const datosAfiliado = jsonAfiliado.data[0];

                // 2. Crear Usuario
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
                    // 3. Actualizar Perfil (Nombre real)
                    const userId = dataReg.user.id;
                    const token = dataReg.jwt;

                    await fetch(`${STRAPI_URL}/api/users/${userId}`, {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            nombre: datosAfiliado.nombre,
                            apellidos: datosAfiliado.apellidos
                        })
                    });

                    mostrarExitoRegistro();

                } else {
                    resetBtn();
                    if(dataReg.error && dataReg.error.message === 'Email or Username are already taken') {
                        if(window.mostrarModalError) window.mostrarModalError("Aquest usuari ja està registrat. Prova a fer Login.");
                        else alert("Usuari ja registrat.");
                    } else {
                        if(window.mostrarModalError) window.mostrarModalError("Error: " + (dataReg.error?.message || "Error desconegut"));
                        else alert("Error de registre.");
                    }
                }

            } catch (error) {
                console.error(error);
                if(window.mostrarModalError) window.mostrarModalError("Error de connexió.");
                else alert("Error de connexió.");
                resetBtn();
            }
        };
    }

    function mostrarExitoRegistro() {
        registerView.innerHTML = `
            <div style="text-align: center; padding: 20px 0; animation: fadeIn 0.5s;">
                <i class="fa-solid fa-circle-check" style="font-size: 4rem; color: #28a745; margin-bottom: 20px;"></i>
                <h3 style="color: var(--brand-blue); margin-bottom: 10px;">Compte Activat!</h3>
                <p style="color: #666; margin-bottom: 20px;">El teu registre s'ha completat correctament.<br>Ja pots accedir al campus.</p>
                <button id="btn-success-login" class="btn-login" style="background-color: var(--brand-blue) !important;">
                    <i class="fa-solid fa-right-to-bracket"></i> Iniciar Sessió
                </button>
            </div>
        `;
        document.getElementById('btn-success-login').onclick = () => window.location.reload();
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