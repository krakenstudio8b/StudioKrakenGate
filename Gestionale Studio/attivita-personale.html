// js/attivita-personale.js (VERSIONE DEFINITIVA E CORRETTA)
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
    if (!dateString) return null; 
    let date;
    if (dateString.includes('T')) {
        date = new Date(dateString);
    } else {
        date = new Date(dateString + 'T12:00:00Z');
    }
    if (isNaN(date.getTime())) {
        console.warn(`Data non valida ricevuta: ${dateString}`);
        return "Data non valida"; // Restituisce stringa per evitare 'null'
    }
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

// 1. Carica gli eventi del calendario (Già corretto)
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
                    const endDateStr = formatEventDate(event.end);

                    let dateString = startDateStr;
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


// 2. Carica i turni di pulizia (Già corretto)
async function loadMyCleaningTasks(userName, today) {
    const scheduleRef = ref(database, 'cleaningSchedule');
    const q = query(scheduleRef, orderByChild('date'), startAt(today));

    onValue(q, (snapshot) => {
        const myTasks = [];
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const session = childSnapshot.val();
                if (session.assignments) { 
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

// ==========================================================
// --- FUNZIONE ATTIVITÀ (CORRETTA) ---
// ==========================================================
async function loadMyActivities(userName) {
    // 1. Riferimento corretto al nodo 'tasks'
    const tasksRef = ref(database, 'tasks');

    // 2. Rimuoviamo la query, leggiamo tutti i task
    onValue(tasksRef, (snapshot) => {
        const myActivities = [];
        if (snapshot.exists()) {
            const allTasks = snapshot.val(); 

            // 3. Iteriamo sui task (gestendo sia Array che Oggetto)
            Object.values(allTasks).forEach(task => {
                if (!task) return; // Salta elementi nulli

                // 4. Controlla se l'utente è nell'array 'assignedTo' E se non è 'done'
                if (task.assignedTo && Array.isArray(task.assignedTo) && task.assignedTo.includes(userName) && task.status !== 'done') {
                    
                    // 5. Aggiungiamo il task
                    myActivities.push({
                        date: `Scadenza: ${task.dueDate ? formatEventDate(task.dueDate) : 'N/D'}`,
                        title: task.title // Usiamo il titolo del task
                    });
                }
            });
        }
        renderItems(activitiesContainer, myActivities, "Nessuna attività assegnata.");
    });
}
// ==========================================================


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
    loadMyActivities(userName); // Ora questa funzione è corretta
});
