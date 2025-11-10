// js/attivita-personale.js
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
function formatEventDate(dateString) {
    // Aggiungi un orario fittizio per evitare problemi di timezone
    const date = new Date(dateString + 'T12:00:00Z'); 
    return date.toLocaleString('it-IT', {
        weekday: 'short', day: 'numeric', month: 'short'
    });
}

// Funzione generica per renderizzare i risultati
function renderItems(container, items, notFoundMessage) {
    container.innerHTML = '';
    if (items.length === 0) {
        container.innerHTML = `<p class="text-gray-500">${notFoundMessage}</p>`;
        return;
    }
    
    // Ordina per data (il formato data è già 'Gio 01 Gen')
    // Semplice ordinamento testuale, si può migliorare se le date non sono ordinate
    
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

// 1. Carica gli eventi del calendario
async function loadMyCalendarEvents(userName, today) {
    const eventsRef = ref(database, 'calendarEvents');
    // Prendi tutti gli eventi futuri
    const q = query(eventsRef, orderByChild('start'), startAt(today));
    
    onValue(q, (snapshot) => {
        const myEvents = [];
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const event = childSnapshot.val();
                // Filtra: solo se il nome utente è tra i partecipanti
                if (event.participants && event.participants.includes(userName)) {
                    myEvents.push({
                        date: formatEventDate(event.start),
                        title: event.title
                    });
                }
            });
        }
        renderItems(calendarContainer, myEvents, "Nessun evento in calendario.");
    });
}

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
                session.assignments.forEach(task => {
                    if (task.memberName === userName) {
                        myTasks.push({
                            date: formatEventDate(session.date),
                            title: `Turno Pulizia: ${task.zone}`
                        });
                    }
                });
            });
        }
        renderItems(cleaningContainer, myTasks, "Nessun turno di pulizia assegnato.");
    });
}

// 3. Carica le attività (da un nuovo nodo 'activities')
async function loadMyActivities(userName) {
    // NOTA: Questo si aspetta un nuovo nodo "activities" su Firebase
    const activitiesRef = ref(database, 'activities');
    // Query per trovare solo le attività assegnate a questo nome
    const q = query(activitiesRef, orderByChild('assignedToName'), equalTo(userName));

    onValue(q, (snapshot) => {
        const myActivities = [];
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const activity = childSnapshot.val();
                // Filtra solo quelle non completate
                if (activity.status !== 'done') {
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
    // ATTENZIONE: Questo script richiede che 'currentUser' da 'auth-guard.js'
    // contenga il NOME dell'utente (es. currentUser.name = "Simone")
    // perché i turni e il calendario usano i nomi, non gli UID.
    
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
    // loadMyActivities(userName); // Decommenta quando avrai il nodo 'activities'
    
    // Messaggio temporaneo per le attività (finché non crei il nodo 'activities')
    activitiesContainer.innerHTML = '<p class="text-gray-500">Nessuna attività "To-Do" assegnata.</p>';
});
