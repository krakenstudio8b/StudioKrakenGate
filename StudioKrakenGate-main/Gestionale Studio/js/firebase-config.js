// js/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js"; // Importa la funzione getAuth

// La tua configurazione Firebase (è corretta)
const firebaseConfig = {
    apiKey: "AIzaSyBtQZkX6r4F2W0BsIo6nsD27dUZHv3e8RU",
    authDomain: "studio-kraken-gate.firebaseapp.com",
    projectId: "studio-kraken-gate",
    storageBucket: "studio-kraken-gate.firebasestorage.app",
    messagingSenderId: "744360512833",
    appId: "1:744360512833:web:ed0952f304c37bd5ee25c0",
    measurementId: "G-39RLC549LJ",
    databaseURL: "https://studio-kraken-gate-default-rtdb.firebaseio.com"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Crea ed ESPORTA le istanze dei servizi che useremo in tutta l'app
export const database = getDatabase(app);
export const auth = getAuth(app); // <-- QUESTA RIGA MANCAVA O ERA ERRATA
