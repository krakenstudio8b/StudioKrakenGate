// js/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { ENV } from './env-config.js';

// Configurazione Firebase caricata da variabili d'ambiente
const firebaseConfig = {
    apiKey: ENV.FIREBASE_API_KEY,
    authDomain: ENV.FIREBASE_AUTH_DOMAIN,
    projectId: ENV.FIREBASE_PROJECT_ID,
    storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
    appId: ENV.FIREBASE_APP_ID,
    measurementId: ENV.FIREBASE_MEASUREMENT_ID,
    databaseURL: ENV.FIREBASE_DATABASE_URL
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Crea ed esporta le istanze dei servizi
export const database = getDatabase(app);
export const auth = getAuth(app);
