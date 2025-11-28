// js/google-calendar-sync.js
// SINCRONIZZAZIONE BIDIREZIONALE CON GOOGLE CALENDAR

import { GOOGLE_CONFIG } from './google-calendar-config.js';
import { database } from './firebase-config.js';
import { ref, set, push, remove, onValue, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

let tokenClient;
let gapiInited = false;
let gisInited = false;
let isAuthorized = false;
let customAuthCallback = null; // Callback personalizzato dopo l'autenticazione

// Riferimenti Firebase
const eventsRef = ref(database, 'calendarEvents');

// --- INIZIALIZZAZIONE GOOGLE API ---
export async function initGoogleCalendar() {
    await loadGapiScript();
    await loadGisScript();

    // Controlla se esiste già un token valido
    checkExistingAuth();
}

function checkExistingAuth() {
    if (gapiInited && gapi.client.getToken() !== null) {
        isAuthorized = true;
        console.log('Token Google esistente trovato, utente già autenticato');
    }
}

function loadGapiScript() {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
            gapi.load('client', async () => {
                await gapi.client.init({
                    apiKey: '', // Non serve API key per OAuth
                    discoveryDocs: [GOOGLE_CONFIG.DISCOVERY_DOC],
                });
                gapiInited = true;
                console.log('Google API Client inizializzato');
                resolve();
            });
        };
        document.body.appendChild(script);
    });
}

function loadGisScript() {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CONFIG.CLIENT_ID,
                scope: GOOGLE_CONFIG.SCOPES,
                callback: (response) => {
                    if (response.error !== undefined) {
                        console.error('Errore autenticazione:', response);
                        alert('Errore durante l\'autenticazione con Google Calendar.');
                        return;
                    }
                    isAuthorized = true;
                    console.log('Autenticazione Google riuscita');

                    // Chiama il callback personalizzato se impostato
                    if (customAuthCallback) {
                        const callback = customAuthCallback;
                        customAuthCallback = null; // Resetta il callback
                        callback();
                    } else {
                        // Comportamento predefinito: sincronizza da Google a Firebase
                        syncFromGoogleToFirebase();
                    }
                },
            });
            gisInited = true;
            console.log('Google Identity Services inizializzato');
            resolve();
        };
        document.body.appendChild(script);
    });
}

// --- AUTENTICAZIONE ---
export function handleAuthClick(onSuccessCallback) {
    console.log('handleAuthClick chiamato');
    console.log('gapiInited:', gapiInited, 'gisInited:', gisInited);

    if (!gapiInited || !gisInited) {
        console.error('Google API non ancora inizializzato');
        alert('Google Calendar API non ancora pronto. Ricarica la pagina e riprova.');
        return;
    }

    if (gapi.client.getToken() === null) {
        console.log('Richiedo nuovo token...');

        // Salva il callback personalizzato
        customAuthCallback = onSuccessCallback;

        // Richiedi nuovo token (il callback verrà chiamato automaticamente quando l'auth completa)
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        console.log('Già autenticato');
        // Già autenticato
        isAuthorized = true;

        // Chiama il callback immediatamente se fornito
        if (onSuccessCallback) {
            onSuccessCallback();
        }
    }
}

export function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        isAuthorized = false;
        console.log('Disconnesso da Google Calendar');
    }
}

// --- SINCRONIZZAZIONE DA GOOGLE CALENDAR → FIREBASE ---
export async function syncFromGoogleToFirebase() {
    if (!isAuthorized) {
        console.log('Non autenticato, avvio autenticazione...');
        handleAuthClick();
        return;
    }

    try {
        console.log('Sincronizzazione da Google Calendar a Firebase...');

        // Ottieni eventi da Google Calendar
        const response = await gapi.client.calendar.events.list({
            calendarId: GOOGLE_CONFIG.CALENDAR_ID,
            timeMin: new Date().toISOString(),
            showDeleted: false,
            singleEvents: true,
            maxResults: 100,
            orderBy: 'startTime',
        });

        const googleEvents = response.result.items || [];
        console.log(`Trovati ${googleEvents.length} eventi su Google Calendar`);

        // Ottieni eventi da Firebase
        const firebaseSnapshot = await get(eventsRef);
        const firebaseEvents = firebaseSnapshot.exists() ? firebaseSnapshot.val() : {};
        const firebaseEventIds = new Set(
            Object.values(firebaseEvents)
                .filter(e => e.googleEventId)
                .map(e => e.googleEventId)
        );

        // Sincronizza eventi da Google a Firebase
        for (const gEvent of googleEvents) {
            if (!firebaseEventIds.has(gEvent.id)) {
                // Evento nuovo da Google, aggiungilo a Firebase
                const newEventRef = push(eventsRef);
                const firebaseEvent = convertGoogleToFirebase(gEvent, newEventRef.key);
                await set(newEventRef, firebaseEvent);
                console.log(`Evento importato: ${gEvent.summary}`);
            }
        }

        console.log('Sincronizzazione completata!');
    } catch (error) {
        console.error('Errore sincronizzazione:', error);
        alert('Errore durante la sincronizzazione con Google Calendar. Controlla la console.');
    }
}

// --- SINCRONIZZAZIONE DA FIREBASE → GOOGLE CALENDAR ---
export async function syncEventToGoogle(firebaseEvent, firebaseEventId) {
    if (!isAuthorized) {
        console.log('Non autenticato, salvataggio solo su Firebase');
        return null;
    }

    try {
        const googleEvent = convertFirebaseToGoogle(firebaseEvent);

        let response;
        if (firebaseEvent.googleEventId) {
            // Aggiorna evento esistente su Google
            response = await gapi.client.calendar.events.update({
                calendarId: GOOGLE_CONFIG.CALENDAR_ID,
                eventId: firebaseEvent.googleEventId,
                resource: googleEvent,
            });
            console.log(`Evento aggiornato su Google: ${firebaseEvent.title}`);
        } else {
            // Crea nuovo evento su Google
            response = await gapi.client.calendar.events.insert({
                calendarId: GOOGLE_CONFIG.CALENDAR_ID,
                resource: googleEvent,
            });
            console.log(`Evento creato su Google: ${firebaseEvent.title}`);
        }

        return response.result.id; // Ritorna l'ID Google
    } catch (error) {
        console.error('Errore sincronizzazione evento a Google:', error);
        return null;
    }
}

// --- ELIMINAZIONE DA GOOGLE CALENDAR ---
export async function deleteEventFromGoogle(googleEventId) {
    if (!isAuthorized || !googleEventId) {
        return;
    }

    try {
        await gapi.client.calendar.events.delete({
            calendarId: GOOGLE_CONFIG.CALENDAR_ID,
            eventId: googleEventId,
        });
        console.log(`Evento eliminato da Google Calendar`);
    } catch (error) {
        console.error('Errore eliminazione evento da Google:', error);
    }
}

// --- CONVERSIONI FORMATI ---
function convertGoogleToFirebase(gEvent, firebaseId) {
    return {
        id: firebaseId,
        googleEventId: gEvent.id,
        title: gEvent.summary || 'Senza titolo',
        start: gEvent.start.dateTime || gEvent.start.date,
        end: gEvent.end.dateTime || gEvent.end.date,
        description: gEvent.description || '',
        room: gEvent.location || '',
        participants: [],
        backgroundColor: gEvent.colorId ? getColorFromId(gEvent.colorId) : '#3b82f6',
        borderColor: gEvent.colorId ? getColorFromId(gEvent.colorId) : '#3b82f6',
        createdBy: 'google_sync',
        requesterEmail: 'google_sync',
    };
}

function convertFirebaseToGoogle(fEvent) {
    return {
        summary: fEvent.title,
        description: fEvent.description || '',
        location: fEvent.room || '',
        start: {
            dateTime: fEvent.start,
            timeZone: 'Europe/Rome',
        },
        end: {
            dateTime: fEvent.end,
            timeZone: 'Europe/Rome',
        },
        attendees: (fEvent.participants || []).map(name => ({ displayName: name })),
    };
}

function getColorFromId(colorId) {
    // Mappa colori Google Calendar → Hex
    const colors = {
        '1': '#a4bdfc', '2': '#7ae7bf', '3': '#dbadff', '4': '#ff887c',
        '5': '#fbd75b', '6': '#ffb878', '7': '#46d6db', '8': '#e1e1e1',
        '9': '#5484ed', '10': '#51b749', '11': '#dc2127'
    };
    return colors[colorId] || '#3b82f6';
}

// --- CONTROLLO STATO AUTENTICAZIONE ---
export function isGoogleAuthorized() {
    return isAuthorized;
}
