const fetch = require('node-fetch');

exports.handler = async function(event) {
    const STRAPI_URL = process.env.STRAPI_API_URL;
    
    console.log("URL de l'API de Strapi:", STRAPI_URL);
    
    try {
        console.log("Iniciant petició fetch...");
        const response = await fetch(STRAPI_URL); // Crida a l'arrel de l'API
        console.log("Resposta rebuda. Estat:", response.status);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Cos de l'error:", errorBody);
            throw new Error(`La crida a l'API ha fallat amb estat ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Dades rebudes amb èxit.");
        
        return { statusCode: 200, body: JSON.stringify(data.data) };

    } catch (error) {
        console.error("Error final a l'execució:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};