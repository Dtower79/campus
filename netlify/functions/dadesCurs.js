exports.handler = async function(event, context) {
  const STRAPI_URL = process.env.STRAPI_URL;
  
  // CORRECCIÓ CLAU: Llegim 'id' O 'slug'. El que arribi.
  const { id, slug } = event.queryStringParameters;
  const valorBusqueda = id || slug; 

  if (!STRAPI_URL) return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  
  // Si no tenim ni ID ni SLUG, llavors sí que és un error
  if (!valorBusqueda) return { statusCode: 400, body: JSON.stringify({ error: "Falta el paràmetre ID o SLUG" }) };

  try {
    // 1. DETECTAR TIPO DE BÚSQUEDA
    // Comprovem si el que ens ha arribat és només números
    const isNumber = /^\d+$/.test(valorBusqueda);
    
    const populateQuery = "populate[moduls][populate]=*&sort[0]=ordre:asc";
    let url;

    if (isNumber) {
      // Si és un número, busquem per ID
      url = `${STRAPI_URL}/api/cursos/${valorBusqueda}?${populateQuery}`;
    } else {
      // Si és text, busquem pel filtre de SLUG
      url = `${STRAPI_URL}/api/cursos?filters[slug][$eq]=${valorBusqueda}&${populateQuery}`;
    }

    // 2. HACER LA PETICIÓN
    const response = await fetch(url);
    
    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: response.statusText }) };
    }

    const dades = await response.json();

    // 3. EXTRAER EL CURSO
    let cursRaw;
    
    if (!dades.data) {
      return { statusCode: 404, body: JSON.stringify({ error: "No se han recibido datos" }) };
    }

    // Si busquem per filtre (slug), Strapi torna un Array. Agafem el primer element.
    if (Array.isArray(dades.data)) {
      if (dades.data.length === 0) return { statusCode: 404, body: JSON.stringify({ error: "Curso no encontrado" }) };
      cursRaw = dades.data[0];
    } else {
      cursRaw = dades.data;
    }

    // 4. NETEJA DE DADES (Universal Strapi v4/v5)
    const props = cursRaw.attributes ? cursRaw.attributes : cursRaw;

    // Aplanamos los Módulos
    let modulsNets = [];
    const modulsRaw = props.moduls?.data || props.moduls;

    if (Array.isArray(modulsRaw)) {
      modulsNets = modulsRaw.map(m => {
        const mProps = m.attributes ? m.attributes : m;
        
        const intregratedQuestions = mProps.preguntes || []; 
        
        return {
          id: m.id,
          ...mProps,
          preguntes: intregratedQuestions
        };
      });
    }

    const cursNet = {
      id: cursRaw.id,
      ...props,
      moduls: modulsNets
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
    console.error("Error en dadesCurs:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};