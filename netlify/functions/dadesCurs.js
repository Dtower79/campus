exports.handler = async function(event, context) {
  console.log(">>> VERSIÓ 5.0: AUDITORIA DE DADES FINALS");

  const STRAPI_URL = process.env.STRAPI_URL;
  const { id, slug } = event.queryStringParameters;
  const valorBusqueda = id || slug; 

  if (!STRAPI_URL) return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  if (!valorBusqueda) return { statusCode: 400, body: JSON.stringify({ error: "Falta ID o SLUG" }) };

  try {
    const isNumber = /^\d+$/.test(valorBusqueda);
    // IMPORTANT: Tornem a posar el sort als mòduls a veure si Strapi v5 ho accepta així, 
    // si no, l'ordenació JS del final ens salvarà.
    const populateQuery = "populate[moduls][populate]=*"; 
    
    let url = isNumber 
      ? `${STRAPI_URL}/api/cursos/${valorBusqueda}?${populateQuery}`
      : `${STRAPI_URL}/api/cursos?filters[slug][$eq]=${valorBusqueda}&${populateQuery}`;

    const response = await fetch(url);
    if (!response.ok) return { statusCode: response.status, body: JSON.stringify({ error: response.statusText }) };

    const dades = await response.json();

    // LOG DE VERITAT: Què ens ha donat Strapi exactament?
    // console.log("Strapi Raw:", JSON.stringify(dades));

    let cursRaw;
    if (dades.data) {
      if (Array.isArray(dades.data)) {
        cursRaw = dades.data.length > 0 ? dades.data[0] : null;
      } else {
        cursRaw = dades.data;
      }
    }

    if (!cursRaw) {
      console.warn(">>> ALERTA: Strapi ha tornat dades buides o null");
      return { statusCode: 404, body: JSON.stringify({ error: "Curs no trobat" }) };
    }

    // APLANAMENT
    const props = cursRaw.attributes ? cursRaw.attributes : cursRaw;
    
    let modulsNets = [];
    const modulsRaw = props.moduls?.data || props.moduls;

    if (Array.isArray(modulsRaw)) {
      modulsNets = modulsRaw.map(m => {
        const mProps = m.attributes ? m.attributes : m;
        const intregratedQuestions = mProps.preguntes || []; 
        return { id: m.id, ...mProps, preguntes: intregratedQuestions };
      });
      // Ordenem per si de cas
      modulsNets.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    }

    const cursNet = {
      id: cursRaw.id,
      ...props,
      moduls: modulsNets
    };

    // EL LOG DEFINITIU: Aquest és el JSON exacte que rep la teva web
    console.log(">>> JSON FINAL ENVIAT AL FRONTEND:", JSON.stringify(cursNet));

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