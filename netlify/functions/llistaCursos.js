exports.handler = async function(event, context) {
  const STRAPI_URL = process.env.STRAPI_URL;

  if (!STRAPI_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "La variable STRAPI_URL no està configurada a Netlify" })
    };
  }

  try {
    // Fem la petició a l'API de Strapi
    // ?populate=* serveix per portar imatges i relacions si calgués
    const response = await fetch(`${STRAPI_URL}/api/cursos?populate=*`);
    
    if (!response.ok) {
      throw new Error(`Error de xarxa: ${response.statusText}`);
    }

    const dades = await response.json();

    // TRACTAMENT DE DADES (Aplanament)
    // Strapi retorna: { data: [ { id: 1, attributes: { titol: "..." } } ] }
    // El teu frontend vol: [ { id: 1, titol: "..." } ]
    
    const cursosNets = dades.data.map(curs => ({
      id: curs.id,
      ...curs.attributes
    }));

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