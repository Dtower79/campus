exports.handler = async function(event, context) {
  const STRAPI_URL = process.env.STRAPI_URL;
  const { id } = event.queryStringParameters;

  if (!STRAPI_URL) return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: "Falta ID" }) };

  try {
    const isNumber = /^\d+$/.test(id);
    const populateQuery = "populate[moduls][populate]=*&sort[0]=ordre:asc";
    let url;

    if (isNumber) {
      url = `${STRAPI_URL}/api/cursos/${id}?${populateQuery}`;
    } else {
      url = `${STRAPI_URL}/api/cursos?filters[slug][$eq]=${id}&${populateQuery}`;
    }

    const response = await fetch(url);
    if (!response.ok) return { statusCode: response.status, body: JSON.stringify({ error: response.statusText }) };

    const dades = await response.json();
    let cursRaw;

    if (!isNumber && dades.data && dades.data.length > 0) {
      cursRaw = dades.data[0];
    } else if (isNumber && dades.data) {
      cursRaw = dades.data;
    }

    if (!cursRaw) return { statusCode: 404, body: JSON.stringify({ error: "Curs no trobat" }) };

    // --- LÓGICA UNIVERSAL DE APILANAMIENTO ---
    const props = cursRaw.attributes ? cursRaw.attributes : cursRaw;
    
    const modulsRaw = props.moduls?.data || props.moduls;
    const modulsNets = Array.isArray(modulsRaw) ? modulsRaw.map(m => {
        const mProps = m.attributes ? m.attributes : m;
        return {
            id: m.id,
            ...mProps,
            preguntes: mProps.preguntes || [] // Las preguntas suelen venir planas
        };
    }) : [];

    const cursNet = {
      id: cursRaw.id,
      ...props,
      moduls: modulsNets
    };
    // -----------------------------------------

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(cursNet),
    };

  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};