const fetch = require('node-fetch');

exports.handler = async function(event) {
    const STRAPI_URL = process.env.STRAPI_API_URL;
    
    // LÍNIA DE DEPURACIÓ: Veurem aquest missatge als logs de Netlify.
    console.log("Intentant connectar a l'API de Strapi a:", STRAPI_URL);
    
    const apiUrl = `${STRAPI_URL}/cursos?fields[0]=titol&fields[1]=slug&fields[2]=descripcio`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorBody = await response.text();
            // Aquest console.log també és clau si hi ha un error
            console.error("Strapi ha retornat un error:", errorBody);
            throw new Error(`Error de Strapi: ${response.status}`);
        }
        const data = await response.json();
        
        return { statusCode: 200, body: JSON.stringify(data.data) };
    } catch (error) {
        console.error("Error a llistaCursos.js:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};