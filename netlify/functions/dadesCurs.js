exports.handler = async function(event, context) {
  console.log(">>> VERSIÓ 4.0 (DETECTIU): Buscant l'error de Slug");

  const STRAPI_URL = process.env.STRAPI_URL;
  const { id, slug } = event.queryStringParameters;
  const valorBusqueda = id || slug; 

  if (!STRAPI_URL) return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  if (!valorBusqueda) return { statusCode: 400, body: JSON.stringify({ error: "Falta ID o SLUG" }) };

  try {
    const isNumber = /^\d+$/.test(valorBusqueda);
    
    // 1. Intentem buscar el curs
    // Nota: Hem tret el 'sort' que donava error 400.
    const populateQuery = "populate[moduls][populate]=*";
    let url;

    if (isNumber) {
      url = `${STRAPI_URL}/api/cursos/${valorBusqueda}?${populateQuery}`;
    } else {
      url = `${STRAPI_URL}/api/cursos?filters[slug][$eq]=${valorBusqueda}&${populateQuery}`;
    }
    
    console.log(`Buscant: ${valorBusqueda} | URL: ${url}`);

    const response = await fetch(url);
    const dades = await response.json();

    // 2. VERIFICACIÓ DE RESULTATS
    let cursRaw;
    let trobat = false;

    if (dades.data) {
      if (Array.isArray(dades.data)) {
        if (dades.data.length > 0) {
          cursRaw = dades.data[0];
          trobat = true;
        }
      } else if (dades.data.id) { // És un objecte
        cursRaw = dades.data;
        trobat = true;
      }
    }

    // 3. SI NO EL TROBEM... FEM DE DETECTIUS
    if (!trobat) {
      console.warn(`⚠️ NO S'HA TROBAT EL CURS: "${valorBusqueda}"`);
      
      // Fem una petició extra per veure quins cursos EXISTEIXEN realment
      // Així veurem al log quin és l'slug correcte
      const checkResponse = await fetch(`${STRAPI_URL}/api/cursos`);
      const checkData = await checkResponse.json();
      
      if (checkData.data) {
        const slugsDisponibles = checkData.data.map(c => c.attributes ? c.attributes.slug : c.slug);
        console.log(">>> LLISTA D'SLUGS REALS A LA DB:", JSON.stringify(slugsDisponibles));
      }

      return { statusCode: 404, body: JSON.stringify({ error: "Curs no trobat. Mira els logs de Netlify." }) };
    }

    // 4. SI EL TROBEM, PROCESSEM LES DADES
    const props = cursRaw.attributes ? cursRaw.attributes : cursRaw;
    
    let modulsNets = [];
    const modulsRaw = props.moduls?.data || props.moduls;

    if (Array.isArray(modulsRaw)) {
      modulsNets = modulsRaw.map(m => {
        const mProps = m.attributes ? m.attributes : m;
        const intregratedQuestions = mProps.preguntes || []; 
        return { id: m.id, ...mProps, preguntes: intregratedQuestions };
      });
      // Ordenació per JS
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