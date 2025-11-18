// Arxiu: netlify/functions/dadesCurs.js

exports.handler = async function(event) {
    // Obtenim l'URL del nostre CMS des de les variables d'entorn de Netlify.
    const STRAPI_URL = process.env.STRAPI_API_URL;
    const courseSlug = event.queryStringParameters.slug;

    if (!courseSlug) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Slug no proporcionat' }) };
    }
    
    // Aquesta és una consulta potent a l'API de Strapi. Li demanem:
    // "Porta'm el curs que tingui aquest slug, i inclou també tots els seus mòduls, 
    // i dins de cada mòdul, inclou totes les seves preguntes, i dins de cada pregunta, inclou totes les seves opcions."
    const apiUrl = `${STRAPI_URL}/cursos?filters[slug][$eq]=${courseSlug}&populate[moduls][populate][preguntes][populate]=opcions`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('Error al demanar les dades detallades del curs a Strapi');
        }
        const data = await response.json();
        
        // L'API de Strapi sempre retorna una llista, fins i tot si només hi ha un resultat.
        if (!data.data || data.data.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Curs no trobat' }) };
        }
        
        // Retornem només el primer (i únic) resultat de la llista.
        return { statusCode: 200, body: JSON.stringify(data.data[0]) };

    } catch (error) {
        console.error("Error a dadesCurs.js:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};