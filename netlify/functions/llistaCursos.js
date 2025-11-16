// Arxiu: netlify/functions/llistaCursos.js

exports.handler = async function(event, context) {
    // Obtenim l'URL del nostre CMS des de la variable d'entorn que acabem de crear.
    const STRAPI_URL = process.env.STRAPI_API_URL;
    
    // Aquesta és l'URL per demanar a Strapi tots els 'cursos'.
    // Li demanem només els camps que necessitem per a la llista (titol, slug, descripcio)
    // per fer la consulta més ràpida.
    const apiUrl = `${STRAPI_URL}/cursos?fields[0]=titol&fields[1]=slug&fields[2]=descripcio`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('Error al demanar la llista de cursos a Strapi');
        }
        const data = await response.json();
        
        // Retornem directament la llista de cursos.
        // Strapi embolcalla les dades en un objecte 'data'.
        return { statusCode: 200, body: JSON.stringify(data.data) };

    } catch (error) {
        console.error("Error a llistaCursos.js:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};