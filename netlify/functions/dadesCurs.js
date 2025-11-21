exports.handler = async function(event, context) {
  const STRAPI_URL = process.env.STRAPI_URL;
  
  // Recuperamos el parámetro ID de la URL (puede ser número "1" o texto "mi-curso")
  const { id } = event.queryStringParameters;

  if (!STRAPI_URL) return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: "Falta el parámetro ID" }) };

  try {
    // 1. DETECTAR TIPO DE BÚSQUEDA (ID vs SLUG)
    const isNumber = /^\d+$/.test(id);
    
    // Query para traer Módulos y Preguntas (Deep Populate)
    // populate[moduls][populate]=*  -> Trae módulos y todo lo de dentro (preguntas)
    const populateQuery = "populate[moduls][populate]=*&sort[0]=ordre:asc";
    let url;

    if (isNumber) {
      // Si es número, pedimos por ID estándar
      url = `${STRAPI_URL}/api/cursos/${id}?${populateQuery}`;
    } else {
      // Si es texto, usamos el FILTRO por slug
      url = `${STRAPI_URL}/api/cursos?filters[slug][$eq]=${id}&${populateQuery}`;
    }

    // 2. HACER LA PETICIÓN
    const response = await fetch(url);
    
    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: response.statusText }) };
    }

    const dades = await response.json();

    // 3. EXTRAER EL CURSO (Gestión Array vs Objeto)
    let cursRaw;
    
    if (!dades.data) {
      return { statusCode: 404, body: JSON.stringify({ error: "No se han recibido datos" }) };
    }

    // Si buscamos por filtro (slug), Strapi devuelve un Array [ {...} ]
    // Si buscamos por ID, Strapi devuelve un Objeto { ... }
    if (Array.isArray(dades.data)) {
      if (dades.data.length === 0) return { statusCode: 404, body: JSON.stringify({ error: "Curso no encontrado" }) };
      cursRaw = dades.data[0];
    } else {
      cursRaw = dades.data;
    }

    // 4. LIMPIEZA DE DATOS (FLATTENING / APLANADO)
    // Adaptador Universal (funciona con Strapi v4 y v5)
    
    // A. Aplanamos el Curso
    const props = cursRaw.attributes ? cursRaw.attributes : cursRaw;

    // B. Aplanamos los Módulos
    let modulsNets = [];
    const modulsRaw = props.moduls?.data || props.moduls;

    if (Array.isArray(modulsRaw)) {
      modulsNets = modulsRaw.map(m => {
        const mProps = m.attributes ? m.attributes : m;
        
        // C. Aplanamos las Preguntas (dentro del módulo)
        // Las preguntas suelen ser componentes dinámicos, a veces vienen directas
        const intregratedQuestions = mProps.preguntes || []; 
        
        return {
          id: m.id,
          ...mProps,
          preguntes: intregratedQuestions
        };
      });
    }

    // Construimos el objeto final limpio para el Frontend
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