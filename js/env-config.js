// js/env-config.js
// Configurazioni caricate da variabili d'ambiente tramite Vite

export const ENV = {
    // Firebase - Caricate da .env in locale, da Vercel Environment Variables in produzione
    FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    FIREBASE_MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    FIREBASE_DATABASE_URL: import.meta.env.VITE_FIREBASE_DATABASE_URL,

    // Google API
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
};
