exports.handler = async function(event, context) {
  const STRAPI_URL = process.env.STRAPI_URL;
  
  // 1. Obtenim l'ID del curs que ve per la URL (ex: ?id=1)
  const { id } = event.queryStringParameters;

  if (!STRAPI_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  }

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: "Falta l'ID del curs" }) };
  }

  try {
    // 2. Fem la petició a Strapi
    // Aquesta query és important:
    // populate[moduls][populate]=*  -> Significa: "Porta'm el curs, entra als Mòduls, i dins dels mòduls porta-ho tot (Preguntes)"
    // i també ordenem els mòduls per ordre (sort[0]=ordre:asc)
    const query = `populate[moduls][populate]=*&sort[0]=ordre:asc`;
    
    const response = await fetch(`${STRAPI_URL}/api/cursos/${id}?${query}`);

    if (!response.ok) {
      throw new Error(`Error al CMS: ${response.statusText}`);
    }

    const dades = await response.json();

    // 3. Retornem les dades al frontend
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(dades.data),
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};