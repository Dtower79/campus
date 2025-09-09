// Importem l'eina per parlar amb Supabase.
const { createClient } = require('@supabase/supabase-js');

// Tota Netlify Function exporta un objecte 'handler'.
exports.handler = async function(event, context) {
    
    // Connectem amb Supabase utilitzant les claus secretes que vam guardar a Netlify.
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    // Agafem el 'slug' del curs que ens demana el navegador des de la URL.
    const courseSlug = event.queryStringParameters.slug;

    // Comprovació de seguretat bàsica.
    if (!courseSlug) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Slug del curs no proporcionat' }) };
    }

    try {
        // =======================================================
        //  INICI DEL BLOC DE CODI AMB LA CONSULTA SIMPLIFICADA
        // =======================================================
        
        // Aquesta consulta utilitza '*' per demanar TOTS els camps de cada taula.
        // És la forma més directa de demanar dades relacionades i sovint resol problemes
        // de permisos o de sintaxi complexa.
        const { data, error } = await supabase
            .from('cursos')
            .select(`
                *,
                moduls (
                    *,
                    preguntes ( * )
                )
            `)
            .eq('slug', courseSlug)
            .order('ordre', { foreignTable: 'moduls' })
            .single();

        // =======================================================
        //  FI DEL BLOC DE CODI AMB LA CONSULTA SIMPLIFICADA
        // =======================================================

        // Gestionem els possibles errors que pugui retornar Supabase.
        if (error) {
            throw error;
        }

        // Si la consulta va bé però no troba cap curs, retornem un error 404.
        if (!data) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Curs no trobat' }) };
        }

        // Si tot ha anat perfecte, retornem les dades.
        return { statusCode: 200, body: JSON.stringify(data) };

    } catch (error) {
        console.error("Error a la funció de Supabase (dadesCurs.js):", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};