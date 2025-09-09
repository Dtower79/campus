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
        // Fem la consulta a la base de dades.
        const { data, error } = await supabase
            .from('cursos')
            .select(`
                titol,
                descripcio,
                moduls ( titol, resum, preguntes ( pregunta, opcions, explicacio ) )
            `)
            .eq('slug', courseSlug)
            .order('ordre', { referencedTable: 'moduls' })
            .single();

        // Gestionem els possibles errors de la consulta.
        if (error) throw error;
        if (!data) return { statusCode: 404, body: JSON.stringify({ error: 'Curs no trobat' }) };

        // Si tot ha anat bé, retornem les dades.
        return { statusCode: 200, body: JSON.stringify(data) };

    } catch (error) {
        console.error("Error a la funció de Supabase:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};