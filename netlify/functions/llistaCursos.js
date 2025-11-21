exports.handler = async function(event, context) {
  const STRAPI_URL = process.env.STRAPI_URL;

  if (!STRAPI_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "La variable STRAPI_URL no està configurada a Netlify" })
    };
  }

  try {
    const response = await fetch(`${STRAPI_URL}/api/cursos?populate=*`);
    
    if (!response.ok) {
      throw new Error(`Error de xarxa: ${response.statusText}`);
    }

    const dades = await response.json();

    // TRACTAMENT DE DADES "PROFUND"
    // Aplanem el curs i també les seves relacions (imatges, mòduls, etc.)
    // perquè el frontend no es trobi amb objectes { data: ... } inesperats.
    
    const cursosNets = dades.data.map(curs => {
      const attrs = curs.attributes;

      return {
        id: curs.id,
        ...attrs,
        // Si 'moduls' existeix, traiem la capa 'data' per deixar l'array net
        moduls: attrs.moduls?.data ? attrs.moduls.data.map(m => ({ id: m.id, ...m.attributes })) : [],
        
        // Si tens imatges, fem el mateix. Si és null, posem null.
        imatge: attrs.imatge?.data ? attrs.imatge.data.attributes.url : null,
        
        // Ídem per qualsevol altra relació que pugui causar conflicte
        categories: attrs.categories?.data ? attrs.categories.data.map(c => c.attributes) : []
      };
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", 
      },
      body: JSON.stringify(cursosNets),
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error connectant amb el CMS", detalls: error.message }),
    };
  }
};