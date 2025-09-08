const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
    // SEGURETAT: El primer de tot és assegurar-nos que qui pregunta és un usuari identificat.
    const { user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: "No autoritzat" }) };
    }
    
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    try {
        // AQUESTA ÉS LA CONSULTA CLAU:
        // "De la taula 'matricules', porta'm tota la informació (*) dels 'cursos' relacionats,
        //  però només de les files on la columna 'usuari_id' sigui igual a l'ID de l'usuari que fa la petició."
        const { data, error } = await supabase
            .from('matricules')
            .select('cursos(*)')
            .eq('usuari_id', user.sub); // user.sub conté l'ID de l'usuari loguejat.

        if (error) throw error;
        
        // La consulta retorna un array d'objectes com [{ cursos: {...} }, { cursos: {...} }].
        // El netegem per retornar només un array de cursos.
        const cursos = data.map(item => item.cursos);

        return { statusCode: 200, body: JSON.stringify(cursos) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};