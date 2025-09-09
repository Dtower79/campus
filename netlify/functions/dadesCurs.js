// Importem l'eina per parlar amb Supabase.
const { createClient } = require('@supabase/supabase-js');

// Tota Netlify Function exporta un objecte 'handler', que és el que s'executa quan es crida la funció.
exports.handler = async function(event, context) {
    
    // Connectem amb Supabase utilitzant les claus secretes que vam guardar a Netlify.
    // Això és segur perquè aquest codi s'executa al servidor de Netlify, no al navegador.
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    // Agafem el 'slug' del curs que ens demana el navegador des de la URL.
    // Per exemple, si la URL és "...?slug=el-meu-curs", courseSlug serà "el-meu-curs".
    const courseSlug = event.queryStringParameters.slug;

    // Comprovació de seguretat bàsica. Si la petició no inclou un slug, retornem un error.
    if (!courseSlug) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Slug del curs no proporcionat' }) };
    }

    try {
        // =======================================================
        //  INICI DEL BLOC DE CODI AMB LA CONSULTA CORREGIDA
        // =======================================================
        
        // Aquesta és la consulta a la base de dades, ara més explícita.
        const { data, error } = await supabase
            .from('cursos') // Des de la taula 'cursos'...
            .select(`
                titol,
                descripcio,
                moduls (
                    id,
                    titol,
                    resum,
                    preguntes ( * )
                )
            `) // ...selecciona aquests camps i els seus "fills" relacionats.
            .eq('slug', courseSlug) // ...però només per al curs que coincideixi amb el slug.
            .order('ordre', { foreignTable: 'moduls' }) // ...i ordena els mòduls pel seu número d'ordre.
            .single(); // ...i esperem només un resultat.

        // =======================================================
        //  FI DEL BLOC DE CODI AMB LA CONSULTA CORREGIDA
        // =======================================================

        // Gestionem els possibles errors que pugui retornar Supabase durant la consulta.
        if (error) {
            // Si hi ha un error, el llancem per a que sigui capturat pel bloc 'catch'.
            throw error;
        }

        // Si la consulta va bé però no troba cap curs, retornem un error 404.
        if (!data) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Curs no trobat' }) };
        }

        // Si tot ha anat perfecte, retornem un codi 200 (OK) i les dades del curs.
        return { statusCode: 200, body: JSON.stringify(data) };

    } catch (error) {
        // Aquest bloc 'catch' captura qualsevol error que hagi passat dins del bloc 'try'.
        console.error("Error a la funció de Supabase (dadesCurs.js):", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};