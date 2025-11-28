#!/usr/bin/env node
// build-env.js
// Script per iniettare le variabili d'ambiente durante il build su Vercel

const fs = require('fs');
const path = require('path');

// Leggi le variabili d'ambiente
const env = {
    VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || '',
    VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || '',
    VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID || '',
    VITE_FIREBASE_MEASUREMENT_ID: process.env.VITE_FIREBASE_MEASUREMENT_ID || '',
    VITE_FIREBASE_DATABASE_URL: process.env.VITE_FIREBASE_DATABASE_URL || '',
    VITE_GOOGLE_CLIENT_ID: process.env.VITE_GOOGLE_CLIENT_ID || '',
};

// Crea lo script da iniettare negli HTML
const envScript = `
<script>
window.__ENV__ = ${JSON.stringify(env, null, 2)};
</script>
`;

// Lista dei file HTML da processare
const htmlFiles = [
    'index.html',
    'login.html',
    'calendario.html',
    'documenti.html',
    'finanze.html',
    'admin.html',
    'pulizie.html',
    'attivita-personale.html'
];

console.log('🔧 Iniettando variabili d\'ambiente negli HTML...');

htmlFiles.forEach(file => {
    const filePath = path.join(__dirname, file);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File non trovato: ${file}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Rimuovi eventuali script __ENV__ precedenti
    content = content.replace(/<script>\s*window\.__ENV__[\s\S]*?<\/script>/g, '');

    // Inietta il nuovo script prima del </head>
    content = content.replace('</head>', `${envScript}</head>`);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file} aggiornato`);
});

console.log('✨ Build completato!');
