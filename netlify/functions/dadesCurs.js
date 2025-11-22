// netlify/functions/dadesCurs.js
// Versión: Strapi v5 Compatible + Endpoint 'cursos'

exports.handler = async function(event, context) {
    // 1. Obtener parámetros y credenciales
    const { slug } = event.queryStringParameters;
    const strapiUrl = process.env.STRAPI_URL;
    const strapiToken = process.env.STRAPI_API_TOKEN;

    // Configuración de cabeceras para evitar errores CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // 2. Validaciones iniciales
    if (!slug) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Falta el paràmetre slug' })
        };
    }

    if (!strapiUrl || !strapiToken) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Error de configuració al servidor (falten credencials)' })
        };
    }

    try {
        console.log(`🔍 Buscant curs: "${slug}" a la base de dades...`);

        // 3. Construcción de la Query (Strapi v5)
        // IMPORTANTE: Usamos 'cursos' porque es lo que descubrió el script debug.js
        const endpoint = "cursos"; 
        
        // Deep Populate: Traer curso -> módulos -> preguntas -> opciones
        const query = `filters[slug][$eq]=${slug}&populate[moduls][populate][preguntes][populate]=opcions`;
        const url = `${strapiUrl}/api/${endpoint}?${query}`;

        // 4. Petición a Strapi
        const response = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${strapiToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`Error Strapi: ${response.status} ${response.statusText}`);
            throw new Error(`Error connectant amb Strapi: ${response.statusText}`);
        }

        const data = await response.json();

        // 5. Verificar si hay resultados
        if (!data.data || data.data.length === 0) {
            console.warn(`Curs no trobat per al slug: ${slug}`);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: "Curs no trobat" })
            };
        }

        // 6. Limpieza y Aplanado de Datos (Data Flattening)
        // Convertimos la estructura compleja de Strapi en algo simple para la web
        const cursoRaw = data.data[0];
        
        const cursoLimpio = {
            id: cursoRaw.id,
            titol: cursoRaw.titol || cursoRaw.text || "Curs sense títol",
            descripcio: cursoRaw.descripcio || "",
            moduls: []
        };

        if (cursoRaw.moduls) {
            cursoLimpio.moduls = cursoRaw.moduls.map(m => ({
                id: m.id,
                titol: m.titol,
                ordre: m.ordre,
                preguntes: (m.preguntes || []).map(p => ({
                    id: p.id,
                    // Detectamos si el campo se llama 'text' (nuevo) o 'titol' (viejo)
                    text: p.text || p.titol || "Pregunta sense enunciat",
                    // Pasamos la explicación tal cual (objeto Blocks o String)
                    explicacio: p.explicacio, 
                    opcions: (p.opcions || []).map(o => ({
                        text: o.text,
                        esCorrecta: o.esCorrecta
                    }))
                }))
            }));

            // Ordenar módulos por el campo 'ordre' si existe
            if (cursoLimpio.moduls.length > 0 && cursoLimpio.moduls[0].ordre !== undefined) {
                cursoLimpio.moduls.sort((a, b) => a.ordre - b.ordre);
            }
        }

        // 7. Respuesta Exitosa
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(cursoLimpio)
        };

    } catch (error) {
        console.error("Error greu en dadesCurs:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                details: "Revisa els logs de Netlify per a més detalls."
            })
        };
    }
}; 
// FIN DEL ARCHIVO (Asegúrate de que esta llave de cierre }; esté presente)