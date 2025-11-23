// js/dashboard.js - MODO ESPÍA 🕵️‍♂️

document.addEventListener('DOMContentLoaded', () => {
    loadSpyMode();
});

async function loadSpyMode() {
    const coursesList = document.getElementById('courses-list');
    const token = localStorage.getItem('jwt');
    
    if (!token) return;

    coursesList.innerHTML = '<div class="loader"></div><h3 style="text-align:center">MODO ESPÍA ACTIVADO...</h3>';

    try {
        // 1. Pedimos LAS MATRÍCULAS SIN FILTROS para ver cómo se llaman los campos
        // Usamos populate=* para que nos traiga todas las relaciones (usuario, curso, etc.)
        const url = `${STRAPI_URL}/api/matriculas?populate=*`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        // 2. Mostramos el resultado BRUTO en la pantalla para que hagas captura
        coursesList.innerHTML = `
            <div style="background: #222; color: #0f0; padding: 20px; font-family: monospace; white-space: pre-wrap; word-break: break-all; border-radius: 8px;">
                <strong>ESTRUCTURA DE TU BASE DE DATOS (Mándame esto):</strong>
                
                ${JSON.stringify(data.data, null, 4)}
            </div>
        `;

    } catch (error) {
        coursesList.innerHTML = `<p style="color:red">Error fatal: ${error.message}</p>`;
    }
}