exports.handler = async function(event, context) {
  console.log(">>> VERSIÓ 6.0: DEEP POPULATE (OPCIONS)");

  const STRAPI_URL = process.env.STRAPI_URL;
  const { id, slug } = event.queryStringParameters;
  const valorBusqueda = id || slug; 

  if (!STRAPI_URL) return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  if (!valorBusqueda) return { statusCode: 400, body: JSON.stringify({ error: "Falta ID o SLUG" }) };

  try {
    const isNumber = /^\d+$/.test(valorBusqueda);
    
    // --- EL CANVI CLAU ESTÀ AQUÍ ---
    // Abans: populate[moduls][populate]=*
    // Ara: Li diem explícitament: "Dins dels mòduls, entra a 'preguntes', i dins de 'preguntes', porta-ho TOT (opcions)"
    const populateQuery = "populate[moduls][populate][preguntes][populate]=*"; 
    
    let url = isNumber 
      ? `${STRAPI_URL}/api/cursos/${valorBusqueda}?${populateQuery}`
      : `${STRAPI_URL}/api/cursos?filters[slug][$eq]=${valorBusqueda}&${populateQuery}`;

    const response = await fetch(url);
    if (!response.ok) return { statusCode: response.status, body: JSON.stringify({ error: response.statusText }) };

    const dades = await response.json();

    let cursRaw;
    if (dades.data) {
      if (Array.isArray(dades.data)) {
        cursRaw = dades.data.length > 0 ? dades.data[0] : null;
      } else {
        cursRaw = dades.data;
      }
    }

    if (!cursRaw) {
      return { statusCode: 404, body: JSON.stringify({ error: "Curs no trobat" }) };
    }

    // --- APLANAMENT DE DADES ---
    const props = cursRaw.attributes ? cursRaw.attributes : cursRaw;
    
    let modulsNets = [];
    const modulsRaw = props.moduls?.data || props.moduls;

    if (Array.isArray(modulsRaw)) {
      modulsNets = modulsRaw.map(m => {
        const mProps = m.attributes ? m.attributes : m;
        
        // Ara 'preguntes' ja inclourà les 'opcions' gràcies a la nova query
        const intregratedQuestions = mProps.preguntes || []; 
        
        return { 
          id: m.id, 
          ...mProps, 
          preguntes: intregratedQuestions 
        };
      });
      // Ordenació manual per seguretat
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