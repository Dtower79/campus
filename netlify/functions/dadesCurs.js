// netlify/functions/dadesCurs.js
// Middleware compatible con Strapi v5

exports.handler = async function(event, context) {
    const { slug } = event.queryStringParameters;

    if (!slug) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Falta el paràmetre slug' })
        };
    }

    // Leemos las variables de entorno de Netlify
    const strapiUrl = process.env.STRAPI_URL;
    const strapiToken = process.env.STRAPI_API_TOKEN;

    if (!strapiUrl || !strapiToken) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Configuració del servidor incorrecta (Falten credencials)' })
        };
    }

    try {
        console.log(`🔍 Buscant curs amb slug: ${slug}`);

        // Query para Strapi v5 - Deep Populate
        // Pedimos el curso, sus módulos, y dentro de los módulos, las preguntas y opciones
        const query = `filters[slug][$eq]=${slug}&populate[moduls][populate][preguntes][populate]=opcions`;
        
        const response = await fetch(`${strapiUrl}/api/curses?${query}`, {
            headers: {
                'Authorization': `Bearer ${strapiToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Error Strapi: ${response.statusText}`);
        }

        const data = await response.json();

        // Verificamos si se encontró el curso
        if (!data.data || data.data.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Curs no trobat' })
            };
        }

        // --- LIMPIEZA DE DATOS (FLATTENING) PARA STRAPI v5 ---
        // Strapi v5 a veces devuelve arrays directos y a veces objetos.
        // Vamos a simplificarlo para que el frontend lo entienda fácil.
        
        const cursoRaw = data.data[0]; // El primer curso encontrado
        
        const cursoLimpio = {
            id: cursoRaw.id,
            titol: cursoRaw.titol || cursoRaw.Titulo || "Curs sense títol", // Fallbacks por si acaso
            descripcio: cursoRaw.descripcio || "",
            moduls: []
        };

        // Procesar Módulos
        if (cursoRaw.moduls && Array.isArray(cursoRaw.moduls)) {
            cursoLimpio.moduls = cursoRaw.moduls.map(m => {
                // Procesar Preguntas de cada módulo
                const preguntasLimpias = (m.preguntes || []).map(p => {
                    return {
                        id: p.id,
                        // Aceptamos 'text' (nuevo) o 'titol' (viejo)
                        text: p.text || p.titol || "Pregunta sense text", 
                        explicacio: p.explicacio, // Pasamos el objeto/texto tal cual para que lo procese el front
                        opcions: (p.opcions || []).map(o => ({
                            text: o.text,
                            esCorrecta: o.esCorrecta
                        }))
                    };
                });

                return {
                    id: m.id,
                    titol: m.titol,
                    resum: m.resum,
                    ordre: m.ordre,
                    preguntes: preguntasLimpias
                };
            });

            // Ordenar módulos por orden
            cursoLimpio.moduls.sort((a, b) => a.ordre - b.ordre);
        }

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*', // CORS para evitar bloqueos
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cursoLimpio)
        };

    } catch (error) {
        console.error('Error en dadesCurs:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};