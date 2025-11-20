// js/google-calendar-config.js
// CONFIGURAZIONE GOOGLE CALENDAR API

// ⚠️ ATTENZIONE: NON CARICARE QUESTO FILE SU REPOSITORY PUBBLICI!
// Aggiungi questo file a .gitignore

export const GOOGLE_CONFIG = {
    // Credenziali OAuth 2.0
    CLIENT_ID: '739994757288-0gv73ihiajeu0fpujlcn0moatnds0c9n.apps.googleusercontent.com',
    API_KEY: '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', // Nota: questo è il client secret, non l'API key

    // Scope necessari per Google Calendar
    SCOPES: 'https://www.googleapis.com/auth/calendar',

    // Discovery doc per Google Calendar API
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',

    // ID del calendario da sincronizzare
    // 'primary' = calendario principale dell'utente autenticato
    // Oppure un ID specifico tipo: 'abc123@group.calendar.google.com'
    CALENDAR_ID: 'primary'
};
