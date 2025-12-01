document.addEventListener('DOMContentLoaded', () => {
    console.log("AUTH: Carregat correctament.");

    // REFERENCIAS DOM
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const errorMsg = document.getElementById('login-error-msg');
    const forgotLink = document.getElementById('forgot-pass');

    // --- 1. FUNCIÓN PARA MOSTRAR MODALES (ENCIMA DEL LOGIN) ---
    function lanzarModal(titulo, mensaje, esError = true) {
        const modal = document.getElementById('custom-modal');
        if (!modal) {
            alert(mensaje); // Fallback si falla el HTML
            return;
        }
        
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-msg');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');

        // Configurar Textos
        titleEl.innerText = titulo;
        titleEl.style.color = esError ? "var(--brand-red)" : "var(--brand-blue)"; 
        msgEl.innerHTML = mensaje; // Permite HTML para saltos de línea

        // Configurar Botones (Solo "Entesos")
        if (btnCancel) btnCancel.style.display = 'none'; 
        
        btnConfirm.innerText = "Entesos";
        btnConfirm.style.background = esError ? "var(--brand-red)" : "var(--brand-blue)"; 
        btnConfirm.disabled = false;
        
        // Clonar botón para eliminar eventos antiguos
        const newConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        
        newConfirm.onclick = () => {
            modal.style.display = 'none';
        };

        // Mostrar Modal
        modal.style.display = 'flex';
        // Asegurar que está por encima del login (z-index alto)
        modal.style.zIndex = "30000"; 
    }

    // --- 2. NAVEGACIÓN ENTRE LOGIN Y REGISTRO ---
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

    // --- 3. FORMATO AUTOMÁTICO DNI (MAYÚSCULAS/SIN ESPACIOS) ---
    const inputsDNI = [document.getElementById('login-dni'), document.getElementById('reg-dni')];
    inputsDNI.forEach(input => {
        if(input) {
            input.addEventListener('input', (e) => {
                let val = e.target.value.toUpperCase().replace(/\s/g, '');
                // Eliminar guiones también para estandarizar
                val = val.replace(/-/g, '');
                e.target.value = val;
            });
        }
    });

    // --- 4. RECUPERAR CONTRASENYA ---
    if(forgotLink) {
        forgotLink.onclick = (e) => {
            e.preventDefault();
            const dniVal = document.getElementById('login-dni').value.trim();
            
            if(!dniVal) {
                lanzarModal("Falta informació", "Per recuperar la contrasenya, primer has d'escriure el teu DNI al camp d'usuari.", true);
            } else {
                // Aquí iría la llamada a la API de Forgot Password si Strapi la tiene configurada
                lanzarModal("Sol·licitud Enviada", `Si el DNI <b>${dniVal}</b> és correcte, rebràs un correu amb les instruccions.`, false);
            }
        }
    }

    // --- 5. PROCESO DE LOGIN ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // IMPORTANTE: Detener envío nativo
            
            const dniInput = document.getElementById('login-dni');
            const passInput = document.getElementById('login-pass');
            const btnSubmit = loginForm.querySelector('button[type="submit"]');
            const originalText = btnSubmit.innerText;

            const dni = dniInput.value.trim();
            const pass = passInput.value.trim();

            if (!dni || !pass) {
                lanzarModal("Camps buits", "Si us plau, introdueix DNI i contrasenya.", true);
                return;
            }

            // Feedback visual
            btnSubmit.innerText = "Connectant...";
            btnSubmit.disabled = true;

            try {
                console.log("Intentant login a:", API_ROUTES.login);
                
                const res = await fetch(API_ROUTES.login, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: dni, password: pass })
                });

                const data = await res.json();

                if (res.ok && data.jwt) {
                    console.log("Login èxit");
                    localStorage.setItem('jwt', data.jwt);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // Ocultar login overlay inmediatamente
                    const overlay = document.getElementById('login-overlay');
                    if(overlay) overlay.style.display = 'none';
                    
                    // Mostrar app
                    const app = document.getElementById('app-container');
                    if(app) app.style.display = 'block';
                    
                    // Iniciar lógica dashboard
                    if (window.iniciarApp) window.iniciarApp();
                    else window.location.reload();

                } else {
                    console.warn("Login fallit:", data);
                    lanzarModal("Error d'Accés", "DNI o contrasenya incorrectes.", true);
                }
            } catch (error) {
                console.error("Error xarxa:", error);
                lanzarModal("Error de Connexió", "No s'ha pogut connectar amb el servidor. Revisa la teva connexió.", true);
            } finally {
                // Restaurar botón
                btnSubmit.innerText = originalText;
                btnSubmit.disabled = false;
            }
        });
    }

    // --- 6. PROCESO DE REGISTRO ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btnSubmit = registerForm.querySelector('button[type="submit"]');
            const originalText = btnSubmit.innerText;
            
            const dni = document.getElementById('reg-dni').value.trim();
            const pass = document.getElementById('reg-pass').value;
            const passConf = document.getElementById('reg-pass-conf').value;

            // Validaciones locales
            if (pass !== passConf) { 
                lanzarModal("Atenció", "Les contrasenyes no coincideixen.", true);
                return; 
            }
            if (pass.length < 6) { 
                lanzarModal("Atenció", "La contrasenya ha de tenir mínim 6 caràcters.", true);
                return; 
            }

            btnSubmit.innerText = "Verificant Afiliació...";
            btnSubmit.disabled = true;

            try {
                // PASO 1: Verificar si es afiliado (usando la ruta de config.js o fallback)
                const checkUrl = (typeof API_ROUTES !== 'undefined' && API_ROUTES.checkAffiliate) 
                                 ? `${API_ROUTES.checkAffiliate}?filters[dni][$eq]=${dni}`
                                 : `${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${dni}`;

                const resAfiliado = await fetch(checkUrl);
                const jsonAfiliado = await resAfiliado.json();

                if (!jsonAfiliado.data || jsonAfiliado.data.length === 0) {
                    lanzarModal("DNI no autoritzat", "Aquest DNI no consta com a afiliat actiu al SICAP. Contacta amb secretaria.", true);
                    btnSubmit.innerText = originalText;
                    btnSubmit.disabled = false;
                    return;
                }
                
                const datosAfiliado = jsonAfiliado.data[0];
                btnSubmit.innerText = "Creant compte...";

                // PASO 2: Crear Usuario en Strapi
                const registerPayload = {
                    username: dni,
                    email: datosAfiliado.email || `${dni}@sicap.cat`, // Email fallback si no tiene
                    password: pass,
                    nombre: datosAfiliado.nombre, // Pasamos datos extra si Strapi lo permite en register
                    apellidos: datosAfiliado.apellidos
                };

                const resReg = await fetch(API_ROUTES.register, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(registerPayload)
                });

                const dataReg = await resReg.json();

                if (resReg.ok && dataReg.jwt) {
                    // Éxito total
                    mostrarExitoRegistro();
                } else {
                    // Error de Strapi
                    if(dataReg.error && (dataReg.error.message.includes('taken') || dataReg.error.message.includes('unique'))) {
                        lanzarModal("Usuari existent", "Aquest DNI ja està registrat. Prova a Iniciar Sessió.", true);
                    } else {
                        lanzarModal("Error de Registre", (dataReg.error?.message || "Error desconegut."), true);
                    }
                    btnSubmit.innerText = originalText;
                    btnSubmit.disabled = false;
                }

            } catch (error) {
                console.error(error);
                lanzarModal("Error del Sistema", "Error de connexió durant el registre.", true);
                btnSubmit.innerText = originalText;
                btnSubmit.disabled = false;
            }
        });
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
});