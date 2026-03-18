module.exports = {
    apps: [{
        name: 'whatsapp-bot',
        script: 'index.js',
        cwd: __dirname,
        restart_delay: 5000,
        max_restarts: 50,
        autorestart: true,
        watch: false,
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        out_file: './logs/bot.log',
        error_file: './logs/bot-error.log',
        merge_logs: true,
        env: {
            NODE_ENV: 'production',
            TZ: 'Europe/Rome'
        }
    }]
};
