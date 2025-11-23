// js/config.js

// IMPORTANTE: Sustituye esta URL por la dirección real de tu Strapi en la nube
// Ejemplo: 'https://mi-cms-sicap.onrender.com'
// NO pongas la barra '/' al final.
const STRAPI_URL = 'https://purring-allx-sicap-831823c5.koyeb.app/'; 

const API_ROUTES = {
    login: `${STRAPI_URL}/api/auth/local`,
    register: `${STRAPI_URL}/api/auth/local/register`,
    checkAffiliate: `${STRAPI_URL}/api/afiliados` // Consultará la lista VIP
};