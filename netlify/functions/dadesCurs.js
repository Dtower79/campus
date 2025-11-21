exports.handler = async function(event, context) {
  console.log(">>> VERSIÓ 3.0 (FIX ORDENACIÓ): Eliminat sort de la URL");

  const STRAPI_URL = process.env.STRAPI_URL;
  const { id, slug } = event.queryStringParameters;
  const valorBusqueda = id || slug; 

  if (!STRAPI_URL) return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  if (!valorBusqueda) return { statusCode: 400, body: JSON.stringify({ error: "Falta ID o SLUG" }) };

  try {
    const isNumber = /^\d+$/.test(valorBusqueda);
    
    // FIX: Hem tret "&sort[0]=ordre:asc" d'aquí perquè el Curs no té camp 'ordre'
    const populateQuery = "populate[moduls][populate]=*";
    
    let url;

    if (isNumber) {
      url = `${STRAPI_URL}/api/cursos/${valorBusqueda}?${populateQuery}`;
    } else {
      url = `${STRAPI_URL}/api/cursos?filters[slug][$eq]=${valorBusqueda}&${populateQuery}`;
    }
    
    console.log("URL Sol·licitada:", url);

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("Error Strapi:", response.status, response.statusText);
      return { statusCode: response.status, body: JSON.stringify({ error: response.statusText }) };
    }

    const dades = await response.json();

    if (!dades.data) return { statusCode: 404, body: JSON.stringify({ error: "No data" }) };

    let cursRaw;
    if (Array.isArray(dades.data)) {
      if (dades.data.length === 0) return { statusCode: 404, body: JSON.stringify({ error: "Curs no trobat" }) };
      cursRaw = dades.data[0];
    } else {
      cursRaw = dades.data;
    }

    // --- TRACTAMENT DE DADES ---
    const props = cursRaw.attributes ? cursRaw.attributes : cursRaw;
    
    let modulsNets = [];
    const modulsRaw = props.moduls?.data || props.moduls;

    if (Array.isArray(modulsRaw)) {
      modulsNets = modulsRaw.map(m => {
        const mProps = m.attributes ? m.attributes : m;
        const intregratedQuestions = mProps.preguntes || []; 
        return { id: m.id, ...mProps, preguntes: intregratedQuestions };
      });

      // FIX: Ordenem els mòduls aquí, amb JavaScript, pel camp 'ordre'
      modulsNets.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    }

    const cursNet = {
      id: cursRaw.id,
      ...props,
      moduls: modulsNets
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(cursNet),
    };

  } catch (error) {
    console.error("Error CRÍTIC:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};