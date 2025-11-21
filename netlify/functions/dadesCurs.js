exports.handler = async function(event, context) {
  const STRAPI_URL = process.env.STRAPI_URL;
  
  // Recuperem l'ID o l'Slug de la URL
  const { id } = event.queryStringParameters;

  if (!STRAPI_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  }

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: "Falta el paràmetre ID" }) };
  }

  try {
    let url;
    // Comprovem si 'id' és un número (ex: "1") o un text (ex: "curs-iniciacio")
    const isNumber = /^\d+$/.test(id);
    
    // Query per portar mòduls i les preguntes de dins, ordenats
    const populateQuery = "populate[moduls][populate]=*&sort[0]=ordre:asc";

    if (isNumber) {
      // Si és número, busquem per ID
      url = `${STRAPI_URL}/api/cursos/${id}?${populateQuery}`;
    } else {
      // Si és text, busquem pel camp 'slug'
      url = `${STRAPI_URL}/api/cursos?filters[slug][$eq]=${id}&${populateQuery}`;
    }

    const response = await fetch(url);
    
    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: response.statusText }) };
    }

    const dades = await response.json();
    
    // LÒGICA D'EXTRACCIÓ
    let cursRaw;

    if (!isNumber && dades.data && dades.data.length > 0) {
      // Si busquem per slug, Strapi torna un Array -> agafem el primer
      cursRaw = dades.data[0];
    } else if (isNumber && dades.data) {
      // Si busquem per ID, Strapi torna l'objecte directe
      cursRaw = dades.data;
    }

    if (!cursRaw) {
      return { statusCode: 404, body: JSON.stringify({ error: "Curs no trobat" }) };
    }

    // LÒGICA DE NETEJA (Flattening)
    // Convertim l'estructura complexa de Strapi en l'objecte simple que espera el teu HTML
    const cursNet = {
      id: cursRaw.id,
      ...cursRaw.attributes,
      moduls: cursRaw.attributes.moduls?.data.map(m => ({
        id: m.id,
        ...m.attributes,
        // Els components (preguntes) dins del mòdul ja solen venir nets, 
        // però per si de cas ens assegurem que existeixin
        preguntes: m.attributes.preguntes || [] 
      })) || []
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(cursNet),
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};