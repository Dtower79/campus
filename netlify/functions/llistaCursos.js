exports.handler = async function(event, context) {
  const STRAPI_URL = process.env.STRAPI_URL;
  // 1. VARIABLE CORRECTA (Según tu captura de Netlify)
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN; 

  if (!STRAPI_URL || !STRAPI_TOKEN) {
    console.log("Faltan credenciales en Netlify");
    return { statusCode: 500, body: JSON.stringify({ error: "Config error" }) };
  }

  try {
    // 2. ESTRATEGIA DE DOBLE INTENTO (Cursos vs Curses)
    let endpoint = '/api/cursos?populate=*'; // Tu intuición
    let finalUrl = `${STRAPI_URL}${endpoint}`;
    
    console.log(`Probando endpoint: ${endpoint}`);
    
    let response = await fetch(finalUrl, {
        headers: { "Authorization": `Bearer ${STRAPI_TOKEN}`, "Content-Type": "application/json" }
    });

    // Si da 404 (No encontrado), probamos el plural inglés por defecto 'curses'
    if (response.status === 404) {
        console.log("Endpoint 'cursos' no existe (404). Probando 'curses'...");
        endpoint = '/api/curses?populate=*';
        finalUrl = `${STRAPI_URL}${endpoint}`;
        response = await fetch(finalUrl, {
            headers: { "Authorization": `Bearer ${STRAPI_TOKEN}`, "Content-Type": "application/json" }
        });
    }

    if (!response.ok) {
        console.log(`Error final Strapi: ${response.status}`);
        return { statusCode: 200, body: JSON.stringify([]) }; // Array vacío para activar fallback frontend
    }

    const dades = await response.json();

    if (!dades || !dades.data) {
        return { statusCode: 200, body: JSON.stringify([]) };
    }

    // 3. MAPPEO SEGURO
    const cursosNets = dades.data.map(curs => {
      const props = curs.attributes ? curs.attributes : curs;

      // Gestión de Imagen
      let imatgeUrl = null;
      const imgRaw = props.imatge?.data || props.imatge;
      if (imgRaw) imatgeUrl = imgRaw.attributes?.url || imgRaw.url;

      // Gestión de Descripción (Evitar [object Object] del Rich Text)
      let descText = "Curs de formació SICAP";
      if (typeof props.descripcio === 'string') {
          descText = props.descripcio;
      } else {
          // Si es Rich Text (bloques), ponemos un texto genérico para la lista
          descText = "Fes clic per accedir al contingut complet del curs.";
      }

      return {
        id: curs.id,
        titol: props.titol,
        slug: props.slug,
        descripcioBreu: descText,
        imatge: imatgeUrl
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cursosNets),
    };

  } catch (error) {
    console.error("ERROR BACKEND:", error);
    return { statusCode: 200, body: JSON.stringify([]) };
  }
};