exports.handler = async function(event, context) {
  const STRAPI_URL = process.env.STRAPI_URL;

  if (!STRAPI_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  }

  try {
    // 1. Petició a Strapi
    const response = await fetch(`${STRAPI_URL}/api/cursos?populate=*`);
    
    if (!response.ok) {
      console.error("Error Strapi Response:", response.status, response.statusText);
      return { statusCode: response.status, body: JSON.stringify({ error: response.statusText }) };
    }

    const dades = await response.json();
    
    // LOG DE DEPURACIÓ: Veurem què arriba exactament als logs de Netlify
    console.log("Strapi Raw Data:", JSON.stringify(dades));

    // Si no hi ha dades o el format és incorrecte, retornem array buit per no petar
    if (!dades || !dades.data) {
      console.warn("Format de dades inesperat o buit");
      return { statusCode: 200, body: JSON.stringify([]) };
    }

    // 2. Mapeig "Defensiu" (No petarà encara que faltin camps)
    const cursosNets = dades.data.map(curs => {
      // Protecció contra 'attributes' null
      const attrs = curs.attributes || {};
      
      // Gestió segura de mòduls
      let modulsNets = [];
      if (attrs.moduls && attrs.moduls.data && Array.isArray(attrs.moduls.data)) {
        modulsNets = attrs.moduls.data.map(m => ({
          id: m.id,
          ...(m.attributes || {})
        }));
      }

      // Gestió segura d'imatge
      let imatgeUrl = null;
      // Utilitzem encadenament opcional (?.) per seguretat extrema
      if (attrs.imatge?.data?.attributes?.url) {
        imatgeUrl = attrs.imatge.data.attributes.url;
      }

      return {
        id: curs.id,
        ...attrs,
        moduls: modulsNets, // Ara segur que és un Array, encara que estigui buit
        imatge: imatgeUrl   // Ara segur que és una URL o null
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
    console.error("CRASH CRÍTIC:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error intern del servidor", detalls: error.message }),
    };
  }
};