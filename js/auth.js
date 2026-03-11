/* ==========================================================================
   AUTH.JS (v51.0 - FINAL STABLE & CSP FIX)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Detecció de Paràmetres URL i Token
    const urlParams = new URLSearchParams(window.location.search);
    const resetCode = urlParams.get('code');
    const slugDestino = urlParams.get('slug');
    const token = localStorage.getItem('jwt');

    const views = {
        login: document.getElementById('login-view'),
        register: document.getElementById('register-view'),
        forgot: document.getElementById('forgot-view'),
        reset: document.getElementById('reset-view'),
        app: document.getElementById('app-container'),
        overlay: document.getElementById('login-overlay'),
        dashboard: document.getElementById('dashboard-view'),
        exam: document.getElementById('exam-view')
    };

    function switchView(viewName) {
        const authViews = [views.login, views.register, views.forgot, views.reset];
        authViews.forEach(v => { if(v) v.style.display = 'none'; });
        if(views[viewName]) views[viewName].style.display = 'block';
    }

    // --- LÒGICA D'ARRANQUE (ORDRE DE PRIORITAT) ---

    // A. MODO RECUPERACIÓ (Prioritat 1)
    if (resetCode) {
        console.log("🔑 Modo recuperació detectat.");
        if(views.app) views.app.style.display = 'none';
        if(views.overlay) views.overlay.style.display = 'flex';
        switchView('reset');
        const codeInput = document.getElementById('reset-code');
        if(codeInput) codeInput.value = resetCode;
        return; // Aturem aquí per no carregar la resta de l'app
    }

    // B. USUARI LOGUEJAT (Prioritat 2)
    if (token) {
        if(views.overlay) views.overlay.style.display = 'none';
        if(views.app) views.app.style.display = 'block';

        // Lògica de redirecció directa a curs (SLUG) que abans estava a l'HTML
        if (slugDestino) {
            if(views.dashboard) views.dashboard.style.display = 'none';
            if(views.exam) views.exam.style.display = 'flex';
        }
    } 
    // C. PANTALLA DE LOGIN (Prioritat 3)
    else {
        if(views.app) views.app.style.display = 'none';
        if(views.overlay) views.overlay.style.display = 'flex';
        switchView('login');

        // Avís de contingut protegit si venia per un slug sense login
        if (slugDestino) {
            const loginHeader = document.querySelector('.login-header');
            if(loginHeader && !document.querySelector('.alert-info-lock')) {
                const aviso = document.createElement('div');
                aviso.className = 'alert-info alert-info-lock';
                aviso.style.marginTop = '15px'; aviso.style.fontSize = '0.9rem'; 
                aviso.style.backgroundColor = '#e3f2fd'; aviso.style.color = '#0d47a1'; aviso.style.border = '1px solid #bbdefb';
                aviso.innerHTML = '<i class="fa-solid fa-lock"></i> <strong>Contingut Protegit:</strong><br>Inicia la sessió per accedir directament al curs.';
                loginHeader.appendChild(aviso);
            }
        }
    }

    // --- ESCULTORS D'ESDEVENIMENTS (BOTONS) ---
    document.getElementById('btn-show-register')?.addEventListener('click', (e) => { e.preventDefault(); switchView('register'); });
    document.getElementById('btn-forgot-pass')?.addEventListener('click', (e) => { e.preventDefault(); switchView('forgot'); });
    document.querySelectorAll('.btn-back-login').forEach(btn => {
        btn.addEventListener('click', (e) => { e.preventDefault(); switchView('login'); });
    });

    // --- HELPER MODAL MEJORADO ---
    window.lanzarModal = function(titulo, mensaje, esError = true, callback = null) {
        const modal = document.getElementById('custom-modal');
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-msg');
        const btnConf = document.getElementById('modal-btn-confirm');
        
        if(titleEl) {
            titleEl.innerText = titulo;
            titleEl.style.color = esError ? "var(--brand-red)" : "var(--brand-blue)";
        }
        if(msgEl) msgEl.innerHTML = mensaje;
        
        const btnCancel = document.getElementById('modal-btn-cancel');
        if(btnCancel) btnCancel.style.display = 'none';
        
        if(btnConf) {
            btnConf.innerText = "Entesos";
            btnConf.style.background = esError ? "var(--brand-red)" : "var(--brand-blue)";
            const newBtn = btnConf.cloneNode(true);
            btnConf.parentNode.replaceChild(newBtn, btnConf);
            newBtn.onclick = () => {
                modal.style.display = 'none';
                if (callback) callback();
            };
        }
        modal.style.display = 'flex';
    };

    // 1. LOGIN
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dni = document.getElementById('login-dni').value.trim().toUpperCase();
            const pass = document.getElementById('login-pass').value.trim();
            const btnSubmit = loginForm.querySelector('button[type="submit"]');

            if (!dni || !pass) return lanzarModal("Error", "Camps buits.");
            btnSubmit.innerText = "Connectant..."; btnSubmit.disabled = true;

            try {
                const res = await fetch(API_ROUTES.login, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: dni, password: pass })
                });
                const data = await res.json();
                if (res.ok && data.jwt) {
                    localStorage.setItem('jwt', data.jwt);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.reload(); 
                } else {
                    lanzarModal("Error d'Accés", "DNI o contrasenya incorrectes.");
                }
            } catch (error) {
                lanzarModal("Error de Connexió", "No s'ha pogut connectar amb el servidor.");
            } finally {
                btnSubmit.innerText = "Inicia la sessió"; btnSubmit.disabled = false;
            }
        });
    }

    // 2. REGISTRO
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dni = document.getElementById('reg-dni').value.trim().toUpperCase();
            const pass = document.getElementById('reg-pass').value;
            const passConf = document.getElementById('reg-pass-conf').value;
            const btnSubmit = registerForm.querySelector('button[type="submit"]');

            if (pass.length < 6) return lanzarModal("Contrasenya massa curta", "La contrasenya ha de tenir almenys 6 caràcters.");
            if (pass !== passConf) return lanzarModal("Error", "Les contrasenyes no coincideixen.");
            
            btnSubmit.innerText = "Verificant..."; btnSubmit.disabled = true;

            try {
                const resAfi = await fetch(`${API_ROUTES.checkAffiliate}?filters[dni][$eq]=${dni}`);
                const jsonAfi = await resAfi.json();
                
                if(!jsonAfi.data || jsonAfi.data.length === 0) {
                     lanzarModal("DNI no autoritzat", "No constes com a afiliat actiu.");
                     btnSubmit.innerText = "Validar i Entrar"; btnSubmit.disabled = false;
                     return;
                }

                const afiliado = jsonAfi.data[0];
                const emailAfiliado = afiliado.email; 

                const regRes = await fetch(API_ROUTES.register, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: dni, email: emailAfiliado, password: pass })
                });
                const regData = await regRes.json();

                if(regRes.ok) {
                    lanzarModal("Compte Creat!", `Email trobat: <strong>${emailAfiliado}</strong>.<br>Ja pots iniciar sessió.`, false, () => window.location.reload());
                } else {
                    lanzarModal("Error", regData.error?.message || "Error al crear compte.");
                    btnSubmit.innerText = "Validar i Entrar"; btnSubmit.disabled = false;
                }
            } catch(e) { 
                lanzarModal("Error", "Error de connexió."); 
                btnSubmit.innerText = "Validar i Entrar"; btnSubmit.disabled = false;
            }
        });
    }

    // 3. RECUPERACIÓN
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputDni = document.getElementById('forgot-dni');
            const btnSubmit = forgotForm.querySelector('button');
            const dniLimpio = inputDni.value.trim().toUpperCase().replace(/[- \/\.]/g, '');

            btnSubmit.innerText = "Cercant..."; btnSubmit.disabled = true;

            try {
                const resAfi = await fetch(`${API_ROUTES.checkAffiliate}?filters[dni][$eq]=${dniLimpio}`);
                const jsonAfi = await resAfi.json();
                let emailDestino = (jsonAfi.data && jsonAfi.data[0]) ? jsonAfi.data[0].email : "";

                if (!emailDestino) {
                    lanzarModal("Informació", "Si el DNI és correcte i té un email associat, rebràs un correu en breus moments.");
                    switchView('login');
                    return;
                }

                await fetch(API_ROUTES.forgotPassword, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailDestino })
                });
                
                const maskedEmail = emailDestino.replace(/(.{2})(.*)(@.*)/, "$1***$3");
                lanzarModal("Correu Enviat", `Enllaç enviat a: <strong>${maskedEmail}</strong>.`, false, () => switchView('login'));
            } catch (error) {
                lanzarModal("Error", "No s'ha pogut processar.");
            } finally {
                btnSubmit.innerText = "Enviar Enllaç"; btnSubmit.disabled = false;
            }
        });
    }

    // 4. RESET PASSWORD
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('reset-code').value;
            const pass = document.getElementById('reset-pass').value;
            const passConf = document.getElementById('reset-pass-conf').value;
            const btnSubmit = resetForm.querySelector('button');

            if (pass.length < 6) return lanzarModal("Contrasenya massa curta", "Mínim 6 caràcters.");
            if (pass !== passConf) return lanzarModal("Error", "Les contrasenyes no coincideixen.");

            btnSubmit.innerText = "Canviant..."; btnSubmit.disabled = true;

            try {
                const res = await fetch(API_ROUTES.resetPassword, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: code, password: pass, passwordConfirmation: passConf })
                });

                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem('jwt', data.jwt);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    lanzarModal("Contrasenya Canviada", "Actualitzat amb èxit. Iniciant sessió...", false, () => {
                        window.location.href = window.location.pathname; // Neteja la URL
                    });
                } else {
                    lanzarModal("Error", "L'enllaç ha caducat.");
                }
            } catch (error) {
                lanzarModal("Error", "Error de connexió.");
            } finally {
                btnSubmit.innerText = "Guardar Canvis"; btnSubmit.disabled = false;
            }
        });
    }
});

function togglePasswordVisibility(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        iconElement.classList.replace("fa-eye", "fa-eye-slash");
        iconElement.style.color = "var(--brand-blue)";
    } else {
        input.type = "password";
        iconElement.classList.replace("fa-eye-slash", "fa-eye");
        iconElement.style.color = "#999";
    }
}