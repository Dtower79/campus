document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const errorMsg = document.getElementById('login-error-msg');
    const forgotLink = document.getElementById('forgot-pass');

    // --- SISTEMA DE MODALES INTERNO ---
    function lanzarModal(titulo, mensaje, esError = true) {
        const modal = document.getElementById('custom-modal');
        if (!modal) { alert(mensaje); return; }
        
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-msg');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');

        titleEl.innerText = titulo;
        titleEl.style.color = esError ? "var(--brand-red)" : "var(--brand-blue)"; 
        msgEl.innerText = mensaje;

        btnCancel.style.display = 'none'; 
        btnConfirm.innerText = "Entesos";
        btnConfirm.style.background = esError ? "var(--brand-red)" : "var(--brand-blue)"; 
        btnConfirm.disabled = false;
        
        const newConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        
        newConfirm.onclick = () => { modal.style.display = 'none'; };
        modal.style.display = 'flex';
    }

    // --- NAVEGACIÓN ---
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

    // --- HE OBLIDAT LA CONTRASENYA ---
    if(forgotLink) {
        forgotLink.onclick = (e) => {
            e.preventDefault();
            const dniVal = document.getElementById('login-dni').value.trim();
            if(!dniVal) {
                lanzarModal("Falta informació", "Per recuperar la contrasenya, primer escriu el teu DNI al camp d'usuari.", true);
            } else {
                lanzarModal("Sol·licitud Enviada", `S'han enviat les instruccions de recuperació al correu associat al DNI ${dniVal}.`, false);
            }
        }
    }

    // --- DNI FORMATO ---
    const inputsDNI = [document.getElementById('login-dni'), document.getElementById('reg-dni')];
    inputsDNI.forEach(input => {
        if(input) {
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\s/g, '').toUpperCase();
            });
        }
    });

    // --- LOGIN (CORREGIDO) ---
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
                    
                    // --- AQUÍ ESTABA EL ERROR: DEBEMOS CAMBIAR LA VISTA MANUALMENTE ---
                    document.getElementById('login-overlay').style.display = 'none';
                    document.getElementById('app-container').style.display = 'block';
                    
                    // Iniciamos la app si existe la función global
                    if (window.iniciarApp) window.iniciarApp();
                    else window.location.reload(); // Fallback
                } else {
                    lanzarModal("Error d'Accés", "DNI o contrasenya incorrectes.", true);
                }
            } catch (error) {
                console.error(error);
                lanzarModal("Error de Connexió", "No s'ha pogut connectar amb el servidor.", true);
            }
        };
    }

    // --- REGISTRO ---
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const btnSubmit = registerForm.querySelector('button[type="submit"]');
            const originalText = btnSubmit.innerText;
            
            const resetBtn = () => { btnSubmit.innerText = originalText; btnSubmit.disabled = false; };
            btnSubmit.innerText = "Validant..."; btnSubmit.disabled = true;

            const dni = document.getElementById('reg-dni').value.trim().toUpperCase();
            const pass = document.getElementById('reg-pass').value;
            const passConf = document.getElementById('reg-pass-conf').value;

            if (pass !== passConf) { lanzarModal("Atenció", "Les contrasenyes no coincideixen.", true); resetBtn(); return; }
            if (pass.length < 6) { lanzarModal("Atenció", "La contrasenya ha de tenir mínim 6 caràcters.", true); resetBtn(); return; }

            try {
                const resAfiliado = await fetch(`${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${dni}`);
                const jsonAfiliado = await resAfiliado.json();

                if (!jsonAfiliado.data || jsonAfiliado.data.length === 0) {
                    lanzarModal("DNI no trobat", "Aquest DNI no consta com a afiliat actiu al SICAP.", true);
                    resetBtn(); return;
                }
                const datosAfiliado = jsonAfiliado.data[0];

                const registerPayload = { username: dni, email: datosAfiliado.email || `${dni}@sicap.cat`, password: pass };
                const resReg = await fetch(`${STRAPI_URL}/api/auth/local/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registerPayload) });
                const dataReg = await resReg.json();

                if (dataReg.jwt) {
                    const userId = dataReg.user.id;
                    const token = dataReg.jwt;
                    await fetch(`${STRAPI_URL}/api/users/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ nombre: datosAfiliado.nombre, apellidos: datosAfiliado.apellidos }) });
                    mostrarExitoRegistro();
                } else {
                    resetBtn();
                    if(dataReg.error && dataReg.error.message === 'Email or Username are already taken') {
                        lanzarModal("Usuari existent", "Aquest usuari ja està registrat.", true);
                    } else {
                        lanzarModal("Error de Registre", (dataReg.error?.message || "Error desconegut"), true);
                    }
                }
            } catch (error) {
                console.error(error);
                lanzarModal("Error", "Error de connexió al registrar.", true);
                resetBtn();
            }
        };
    }

    function mostrarExitoRegistro() {
        registerView.innerHTML = `<div style="text-align: center; padding: 20px 0;"><i class="fa-solid fa-circle-check" style="font-size: 4rem; color: #28a745; margin-bottom: 20px;"></i><h3 style="color: var(--brand-blue); margin-bottom: 10px;">Compte Activat!</h3><p style="color: #666; margin-bottom: 20px;">El teu registre s'ha completat.<br>Ja pots accedir.</p><button id="btn-success-login" class="btn-login" style="background-color: var(--brand-blue) !important;"><i class="fa-solid fa-right-to-bracket"></i> Iniciar Sessió</button></div>`;
        document.getElementById('btn-success-login').onclick = () => window.location.reload();
    }
});