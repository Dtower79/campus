exports.handler = async function(event, context) {
    const { slug } = event.queryStringParameters;
    const strapiUrl = process.env.STRAPI_URL;
    const strapiToken = process.env.STRAPI_API_TOKEN;

    // CORS Headers para que tu web no se queje
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (!slug) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el slug' }) };
    }

    try {
        console.log(`🔍 Buscando curso: ${slug} en /api/cursos`);

        // --- RUTA CORRECTA DESCUBIERTA: 'cursos' ---
        const endpoint = "cursos"; 
        
        // Query avanzada para Strapi v5 (Deep Populate)
        const query = `filters[slug][$eq]=${slug}&populate[moduls][populate][preguntes][populate]=opcions`;
        
        const url = `${strapiUrl}/api/${endpoint}?${query}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${strapiToken}` }
        });

        if (!response.ok) {
            throw new Error(`Error Strapi (${response.status}): ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: "Curso no encontrado" }) };
        }

        // --- LIMPIEZA DE DATOS (FLATTENING) ---
        const cursoRaw = data.data[0];
        
        const cursoLimpio = {
            id: cursoRaw.id,
            titol: cursoRaw.titol || cursoRaw.text || "Sense títol",
            descripcio: cursoRaw.descripcio || "",
            moduls: []
        };

        if (cursoRaw.moduls) {
            cursoLimpio.moduls = cursoRaw.moduls.map(m => ({
                id: m.id,
                titol: m.titol,
                // Mapeamos las preguntas
                preguntes: (m.preguntes || []).map(p => ({
                    id: p.id,
                    // Aceptamos 'text' (nuevo) o 'titol' (viejo)
                    text: p.text || p.titol || "Pregunta sense text", 
                    // Pasamos la explicación tal cual (objeto o string) para que el front decida
                    explicacio: p.explicacio, 
                    // Mapeamos opciones