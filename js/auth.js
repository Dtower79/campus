/* ==========================================================================
   AUTH.JS - Gestión de Usuarios y Login
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- DETECCIÓN DE DEEP LINKING (NUEVO) ---
    const urlParams = new URLSearchParams(window.location.search);
    const slugDestino = urlParams.get('slug');
    if (slugDestino && !localStorage.getItem('jwt')) {
        const loginHeader = document.querySelector('.login-header');
        if(loginHeader) {
            const aviso = document.createElement('div');
            aviso.className = 'alert-info';
            aviso.style.marginTop = '15px'; aviso.style.fontSize = '0.9rem'; aviso.style.backgroundColor = '#e3f2fd'; aviso.style.color = '#0d47a1'; aviso.style.border = '1px solid #bbdefb';
            aviso.innerHTML = '<i class="fa-solid fa-lock"></i> <strong>Contingut Protegit:</strong><br>Inicia la sessió per accedir directament al curs.';
            loginHeader.appendChild(aviso);
        }
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');

    function lanzarModal(titulo, mensaje, esError = true) {
        const modal = document.getElementById('custom-modal');
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-msg');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');
        
        titleEl.innerText = titulo; titleEl.style.color = esError ? "var(--brand-red)" : "var(--brand-blue)"; 
        msgEl.innerHTML = mensaje; 
        btnCancel.style.display = 'none'; 
        btnConfirm.innerText = "Entesos"; btnConfirm.style.background = esError ? "var(--brand-red)" : "var(--brand-blue)"; 
        btnConfirm.disabled = false;
        
        const newConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        newConfirm.onclick = () => modal.style.display = 'none';
        modal.style.display = 'flex';
    }

    if (btnShowRegister) btnShowRegister.onclick = (e) => { e.preventDefault(); loginView.style.display = 'none'; registerView.style.display = 'block'; };
    if (btnShowLogin) btnShowLogin.onclick = (e) => { e.preventDefault(); registerView.style.display = 'none'; loginView.style.display = 'block'; };

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
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dni = document.getElementById('reg-dni').value.trim().toUpperCase();
            const pass = document.getElementById('reg-pass').value;
            const passConf = document.getElementById('reg-pass-conf').value;
            const btnSubmit = registerForm.querySelector('button[type="submit"]');

            if(pass !== passConf) return lanzarModal("Error", "Les contrasenyes no coincideixen.");
            
            btnSubmit.innerText = "Verificant..."; btnSubmit.disabled = true;

            try {
                // Verificar si es afiliado
                const resAfi = await fetch(`${API_ROUTES.checkAffiliate}?filters[dni][$eq]=${dni}`);
                const jsonAfi = await resAfi.json();
                
                if(!jsonAfi.data || jsonAfi.data.length === 0) {
                     lanzarModal("DNI no autoritzat", "No constes com a afiliat actiu.");
                     btnSubmit.innerText = "Validar i Entrar"; btnSubmit.disabled = false;
                     return;
                }

                // Crear usuario
                const regRes = await fetch(API_ROUTES.register, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: dni, email: `${dni}@sicap.cat`, password: pass })
                });
                
                if(regRes.ok) {
                    alert("Compte creat! Ara inicia sessió.");
                    window.location.reload();
                } else {
                    const errData = await regRes.json();
                    lanzarModal("Error", errData.error?.message || "Error al crear compte.");
                    btnSubmit.innerText = "Validar i Entrar"; btnSubmit.disabled = false;
                }

            } catch(e) { 
                lanzarModal("Error", "Error de connexió."); 
                btnSubmit.innerText = "Validar i Entrar"; btnSubmit.disabled = false;
            }
        });
    }
});