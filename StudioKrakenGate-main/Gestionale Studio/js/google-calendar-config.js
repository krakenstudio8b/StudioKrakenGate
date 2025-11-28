// js/google-calendar-config.js
// CONFIGURAZIONE GOOGLE CALENDAR API E GOOGLE DRIVE API

import { ENV } from './env-config.js';

export const GOOGLE_CONFIG = {
    // Credenziali OAuth 2.0 caricate da variabili d'ambiente
    CLIENT_ID: ENV.GOOGLE_CLIENT_ID,

    // Scope necessari per Google Calendar
    SCOPES: 'https://www.googleapis.com/auth/calendar',

    // Discovery doc per Google Calendar API
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',

    // ID del calendario da sincronizzare
    // 'primary' = calendario principale dell'utente autenticato
    // Oppure un ID specifico tipo: 'abc123@group.calendar.google.com'
    CALENDAR_ID: 'primary',

    // Configurazione per Google Drive
    DRIVE_SCOPES: 'https://www.googleapis.com/auth/drive',
    DRIVE_DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',

    // ID della cartella condivisa su Drive (opzionale, se vuoi limitare a una cartella specifica)
    // Lascia vuoto per mostrare tutti i file condivisi
    // Per trovare l'ID: apri la cartella su Drive, l'ID è nell'URL dopo /folders/
    DRIVE_FOLDER_ID: ''
};
