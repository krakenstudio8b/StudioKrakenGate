// js/attivita-personale.js (VERSIONE CORRETTA)
import { database } from './firebase-config.js';
import { ref, onValue, query, orderByChild, startAt, equalTo } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';

// --- RIFERIMENTI DOM ---
const welcomeTitle = document.getElementById('welcome-title');
const calendarContainer = document.getElementById('my-calendar-events');
const cleaningContainer = document.getElementById('my-cleaning-tasks');
const activitiesContainer = document.getElementById('my-activities');

// --- FUNZIONI UTILITY ---
function getIsoDate(date) {
    return date.toISOString().split('T')[0];
}

// ==========================================================
// --- FUNZIONE FORMAT EVENT DATE (CORRETTA) ---
// ==========================================================
function formatEventDate(dateString) {
    if (!dateString) return null; // Restituisci null se la stringa è vuota

    let date;
    if (dateString.includes('T')) {
        // È già un datetime (es. "2025-11-10T09:00")
        date = new Date(dateString);
    } else {
        // È solo una data (es. "2025-11-10"), aggiungiamo l'orario fittizio
        date = new Date(dateString + 'T12:00:00Z');
    }

    // Controlla se la data è valida
    if (isNaN(date.getTime())) {
        console.warn(`Data non valida ricevuta: ${dateString}`);
        return null;
    }
    
    return date.toLocaleString('it-IT', {
        weekday: 'short', day: 'numeric', month: 'short'
    });
}
// ==========================================================

// Funzione generica per renderizzare i risultati
function renderItems(container, items, notFoundMessage) {
    container.innerHTML = '';
    if (items.length === 0) {
        container.innerHTML = `<p class="text-gray-500">${notFoundMessage}</p>`;
        return;
    }
    
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'p-3 bg-gray-50 rounded-lg border';
        itemEl.innerHTML = `
            <span class="block text-sm font-semibold text-indigo-600">${item.date}</span>
            <span class="block text-gray-800">${item.title}</span>
        `;
        container.appendChild(itemEl);
    });
}

// --- LOGICHE DI FETCH ---

// ==========================================================
// --- FUNZIONE CALENDARIO (CORRETTA PER MULTI-GIORNO) ---
// ==========================================================
async function loadMyCalendarEvents(userName, today) {
    const eventsRef = ref(database, 'calendarEvents');
    const q = query(eventsRef, orderByChild('start'), startAt(today));
    
    onValue(q, (snapshot) => {
        const myEvents = [];
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const event = childSnapshot.val();
                if (event.participants && event.participants.includes(userName)) {
                    
                    const startDateStr = formatEventDate(event.start);
                    const endDateStr = formatEventDate(event.end); // Prova a formattare anche la fine

                    let dateString = startDateStr;

                    // Se la data di fine esiste ED è diversa dalla data di inizio
                    if (endDateStr && endDateStr !== startDateStr) {
                        dateString = `${startDateStr} - ${endDateStr}`;
                    }

                    myEvents.push({
                        date: dateString,
                        title: event.title
                    });
                }
            });
        }
        renderItems(calendarContainer, myEvents, "Nessun evento in calendario.");
    });
}
// ==========================================================


// 2. Carica i turni di pulizia
async function loadMyCleaningTasks(userName, today) {
    const scheduleRef = ref(database, 'cleaningSchedule');
    // Prendi tutte le sessioni future
    const q = query(scheduleRef, orderByChild('date'), startAt(today));

    onValue(q, (snapshot) => {
        const myTasks = [];
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const session = childSnapshot.val();
                // Filtra: cerca tra gli assegnatari della sessione
                if (session.assignments) { // Aggiunto controllo di sicurezza
                    session.assignments.forEach(task => {
                        if (task.memberName === userName) {
                            myTasks.push({
                                date: formatEventDate(session.date),
                                title: `Turno Pulizia: ${task.zone}`
                            });
                        }
                    });
                }
            });
        }
        renderItems(cleaningContainer, myTasks, "Nessun turno di pulizia assegnato.");
    });
}

// 3. Carica le attività (da un nuovo nodo 'activities')
async function loadMyActivities(userName) {
    const activitiesRef = ref(database, 'activities');
    const q = query(activitiesRef, orderByChild('assignedToName'), equalTo(userName));

    onValue(q, (snapshot) => {
        const myActivities = [];
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const activity = childSnapshot.val();
                if (activity.status !== 'done' && activity.dueDate) { // Aggiunto controllo per dueDate
                    myActivities.push({
                        date: `Scadenza: ${formatEventDate(activity.dueDate)}`,
                        title: activity.description
                    });
                }
            });
        }
        renderItems(activitiesContainer, myActivities, "Nessuna attività assegnata.");
    });
}


// --- PUNTO DI INGRESSO ---
document.addEventListener('authReady', () => {
    if (!currentUser || !currentUser.name) {
        console.error("AuthGuard non ha fornito 'currentUser.name'. Impossibile filtrare i task.");
        welcomeTitle.textContent = "Ciao! Errore nel caricare il tuo nome.";
        calendarContainer.innerHTML = '<p class="text-red-500">Errore: nome utente non trovato.</p>';
        cleaningContainer.innerHTML = '<p class="text-red-500">Errore: nome utente non trovato.</p>';
        activitiesContainer.innerHTML = '<p class="text-red-500">Errore: nome utente non trovato.</p>';
        return;
    }

    const userName = currentUser.name;
    const today = getIsoDate(new Date());
    
    welcomeTitle.textContent = `Ciao, ${userName}!`;

    // Avvia le 3 query
    loadMyCalendarEvents(userName, today);
    loadMyCleaningTasks(userName, today);
    loadMyActivities(userName); // Questa ora gestirà "Nessuna attività" da sola
});
