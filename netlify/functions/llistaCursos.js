exports.handler = async function(event, context) {
  const STRAPI_URL = process.env.STRAPI_URL;

  if (!STRAPI_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: "Falta STRAPI_URL" }) };
  }

  try {
    const response = await fetch(`${STRAPI_URL}/api/cursos?populate=*`);
    
    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: response.statusText }) };
    }

    const dades = await response.json();

    if (!dades || !dades.data) {
      return { statusCode: 200, body: JSON.stringify([]) };
    }

    // MAPPEO UNIVERSAL (Funciona con Strapi v4 y v5)
    const cursosNets = dades.data.map(curs => {
      // 1. Detectamos si los datos están en 'attributes' o en la raíz
      const props = curs.attributes ? curs.attributes : curs;

      // 2. Gestión de Mòduls (Arrays)
      let modulsNets = [];
      // A veces la relación viene dentro de .data, a veces directa
      const modulsRaw = props.moduls?.data || props.moduls;
      
      if (Array.isArray(modulsRaw)) {
        modulsNets = modulsRaw.map(m => {
          const mProps = m.attributes ? m.attributes : m;
          return { id: m.id, ...mProps };
        });
      }

      // 3. Gestión de Imagen
      let imatgeUrl = null;
      const imgRaw = props.imatge?.data || props.imatge;
      if (imgRaw) {
        // A veces es imgRaw.attributes.url, a veces imgRaw.url
        imatgeUrl = imgRaw.attributes?.url || imgRaw.url;
      }

      // 4. Construimos el objeto final plano
      return {
        id: curs.id,
        ...props,       // Esparce titulo, descripcion, etc.
        moduls: modulsNets, // Aseguramos que siempre es un array
        imatge: imatgeUrl
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
    console.error("ERROR:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};