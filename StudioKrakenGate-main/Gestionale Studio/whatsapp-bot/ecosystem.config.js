// ecosystem.config.js
// Configurazione PM2 per avvio automatico del bot WhatsApp

module.exports = {
    apps: [{
        name: 'whatsapp-bot',
        script: 'index.js',
        cwd: __dirname,
        restart_delay: 5000,
        max_restarts: 10,
        autorestart: true,
        watch: false,
        env: {
            NODE_ENV: 'production'
        }
    }]
};
