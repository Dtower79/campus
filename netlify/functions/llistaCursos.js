exports.handler = async function(event, context) {
  // Recuperem la URL de Strapi de les variables d'entorn
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

    // Strapi retorna un objecte { data: [...], meta: {...} }
    // El frontend espera un array directament, així que retornem dades.data
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Permetre CORS
      },
      body: JSON.stringify(dades.data),
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error connectant amb el CMS", detalls: error.message }),
    };
  }
};