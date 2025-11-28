// js/env-config.js
// Script per caricare le variabili d'ambiente in modo sicuro

/**
 * Carica le configurazioni dalle variabili d'ambiente.
 * Su Vercel, le env vars vengono sostituite automaticamente durante il build.
 * In locale, usa un file .env (non committarlo mai!)
 */

// Funzione helper per ottenere variabili d'ambiente
function getEnvVar(key, fallback = '') {
    // In produzione (Vercel), le variabili vengono iniettate come __ENV__
    if (typeof window.__ENV__ !== 'undefined' && window.__ENV__[key]) {
        return window.__ENV__[key];
    }
    // Fallback per sviluppo locale (se presente)
    return fallback;
}

// Esporta le configurazioni
export const ENV = {
    // Firebase
    FIREBASE_API_KEY: getEnvVar('VITE_FIREBASE_API_KEY'),
    FIREBASE_AUTH_DOMAIN: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
    FIREBASE_PROJECT_ID: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
    FIREBASE_STORAGE_BUCKET: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
    FIREBASE_MESSAGING_SENDER_ID: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    FIREBASE_APP_ID: getEnvVar('VITE_FIREBASE_APP_ID'),
    FIREBASE_MEASUREMENT_ID: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID'),
    FIREBASE_DATABASE_URL: getEnvVar('VITE_FIREBASE_DATABASE_URL'),

    // Google API
    GOOGLE_CLIENT_ID: getEnvVar('VITE_GOOGLE_CLIENT_ID'),
};

// Valida che tutte le variabili necessarie siano presenti
const requiredVars = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_DATABASE_URL',
    'GOOGLE_CLIENT_ID'
];

const missingVars = requiredVars.filter(key => !ENV[key]);

if (missingVars.length > 0) {
    console.error('❌ Variabili d\'ambiente mancanti:', missingVars);
    console.error('Configura le variabili d\'ambiente su Vercel o crea un file .env locale');
}
