exports.handler = async function(event, context) {
  // AQUEST LOG ENS CONFIRMARÀ QUE EL CODI NOU S'ESTÀ EXECUTANT
  console.log(">>> VERSIÓ 2.0 CARREGADA: Buscant per ID o SLUG");

  const STRAPI_URL = process.env.STRAPI_URL;
  
  // Recuperem 'id' O 'slug'
  const { id, slug } = event.queryStringParameters;
  const valorBusqueda = id || slug; 

  console.log("Paràmetres rebuts:", { id, slug, valorBusqueda });

  if (!STRAPI_URL) return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  
  if (!valorBusqueda) {
    console.error("Error: Falta paràmetre de cerca");
    return { statusCode: 400, body: JSON.stringify({ error: "Falta el paràmetre ID o SLUG" }) };
  }

  try {
    const isNumber = /^\d+$/.test(valorBusqueda);
    const populateQuery = "populate[moduls][populate]=*&sort[0]=ordre:asc";
    let url;

    if (isNumber) {
      url = `${STRAPI_URL}/api/cursos/${valorBusqueda}?${populateQuery}`;
    } else {
      url = `${STRAPI_URL}/api/cursos?filters[slug][$eq]=${valorBusqueda}&${populateQuery}`;
    }
    
    console.log("Fent petició a:", url); // Per depurar

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("Error resposta Strapi:", response.status);
      return { statusCode: response.status, body: JSON.stringify({ error: response.statusText }) };
    }

    const dades = await response.json();

    if (!dades.data) {
      return { statusCode: 404, body: JSON.stringify({ error: "No s'han rebut dades" }) };
    }

    let cursRaw;
    if (Array.isArray(dades.data)) {
      if (dades.data.length === 0) return { statusCode: 404, body: JSON.stringify({ error: "Curs no trobat" }) };
      cursRaw = dades.data[0];
    } else {
      cursRaw = dades.data;
    }

    // Aplanament de dades
    const props = cursRaw.attributes ? cursRaw.attributes : cursRaw;
    
    let modulsNets = [];
    const modulsRaw = props.moduls?.data || props.moduls;

    if (Array.isArray(modulsRaw)) {
      modulsNets = modulsRaw.map(m => {
        const mProps = m.attributes ? m.attributes : m;
        const intregratedQuestions = mProps.preguntes || []; 
        return { id: m.id, ...mProps, preguntes: intregratedQuestions };
      });
    }

    const cursNet = { id: cursRaw.id, ...props, moduls: modulsNets };

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