// js/calendario.js - VERSIONE COMPLETA CON LISTENER 'authReady' E FIX MEMBRI

import { database } from './firebase-config.js';
import { ref, set, onValue, push, remove, update } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';

// Aspetta il segnale da auth-guard.js prima di fare QUALSIASI COSA.

// --- FUNZIONE DI INIZIALIZZAZIONE ---
function initializeCalendar() {
    // Riferimenti agli elementi del DOM
    const calendarEl = document.getElementById('calendar');
    const eventModal = document.getElementById('event-modal');
    const modalTitle = document.getElementById('modal-title');
    const eventTitleInput = document.getElementById('event-title');
    const eventStartInput = document.getElementById('event-start');
    const eventEndInput = document.getElementById('event-end');
    const eventPrioritySelect = document.getElementById('event-priority');
    const eventRoomSelect = document.getElementById('event-room');
    const eventDescriptionInput = document.getElementById('event-description');
    const participantsContainer = document.getElementById('event-participants-checkboxes');
    const saveEventBtn = document.getElementById('save-event-btn');
    const deleteEventBtn = document.getElementById('delete-event-btn');
    const cancelEventBtn = document.getElementById('cancel-event-btn');
    const addEventExternBtn = document.getElementById('add-event-extern-btn');

    // Riferimenti a Firebase
    const eventsRef = ref(database, 'calendarEvents');
    const pendingEventsRef = ref(database, 'pendingCalendarEvents');
    const membersRef = ref(database, 'members');
    
    // Stato locale
    let currentEventInfo = null;

    // Funzioni per gestire il modale
    const openModal = () => eventModal.classList.remove('hidden');
    const closeModal = () => {
        eventModal.classList.add('hidden');
        currentEventInfo = null;
    };

    const openModalForNewEvent = (info) => {
        modalTitle.textContent = 'Aggiungi Evento';
        eventTitleInput.value = '';
        
        const startDate = info.start ? new Date(info.start) : new Date();
        startDate.setMinutes(startDate.getMinutes() - startDate.getTimezoneOffset());
        eventStartInput.value = startDate.toISOString().slice(0, 16);

        const endDate = info.end ? new Date(info.end) : new Date(startDate);
        if(info.end) {
            const tempEndDate = new Date(info.end);
            tempEndDate.setMinutes(tempEndDate.getMinutes() - tempEndDate.getTimezoneOffset());
            eventEndInput.value = tempEndDate.toISOString().slice(0, 16);
        } else {
             eventEndInput.value = startDate.toISOString().slice(0, 16);
        }
        
        eventDescriptionInput.value = '';
        eventPrioritySelect.value = '#3b82f6';
        eventRoomSelect.value = '';
        participantsContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
        
        deleteEventBtn.classList.add('hidden');
        currentEventInfo = { id: null, isNew: true };
        openModal();
    };
    
    // Inizializzazione di FullCalendar
    const calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'it',
        firstDay: 1,
        initialView: 'dayGridMonth',
        height: 'auto',
        editable: true,
        selectable: true,
    
        handleWindowResize: true,
        windowResizeDelay: 100,
        
        headerToolbar: {
            start: 'prev,next today',
            center: 'title',
            end: 'dayGridMonth,timeGridWeek'
        },
        footerToolbar: {
            start: 'prev,next',
            center: '',
            end: 'listWeek'
        },
        buttonText: {
            today: 'Oggi',
            month: 'Mese',
            week: 'Settimana',
            day: 'Giorno',
            list: 'Agenda'
        },
        height: 'auto',
        editable: true,
        selectable: true,
        
        select: (info) => {
            openModalForNewEvent({ start: info.startStr, end: info.endStr });
        },

        eventClick: (info) => {
            const event = info.event;
            const extendedProps = event.extendedProps || {};
            
            eventTitleInput.value = event.title;
            const startDate = new Date(event.start);
            startDate.setMinutes(startDate.getMinutes() - startDate.getTimezoneOffset());
            eventStartInput.value = startDate.toISOString().slice(0, 16);

            const endDate = event.end ? new Date(event.end) : startDate;
            if(event.end) endDate.setMinutes(endDate.getMinutes() - endDate.getTimezoneOffset());
            eventEndInput.value = endDate.toISOString().slice(0, 16);

            eventDescriptionInput.value = extendedProps.description || '';
            eventPrioritySelect.value = event.backgroundColor || '#3b82f6';
            eventRoomSelect.value = extendedProps.room || '';
            
            participantsContainer.querySelectorAll('input').forEach(cb => {
                cb.checked = (extendedProps.participants || []).includes(cb.value);
            });

            const formElements = eventModal.querySelectorAll('input, select, textarea');

            if (currentUser.role === 'user') {
                modalTitle.textContent = 'Dettagli Evento';
                saveEventBtn.classList.add('hidden');
                deleteEventBtn.classList.add('hidden');
                formElements.forEach(el => el.disabled = true);
            } else {
                modalTitle.textContent = 'Modifica Evento';
                saveEventBtn.classList.remove('hidden');
                deleteEventBtn.classList.remove('hidden');
                formElements.forEach(el => el.disabled = false);
            }

            currentEventInfo = { id: event.id, isNew: false };
            openModal();
        },

        eventDrop: (info) => {
            if (currentUser.role === 'user') {
                alert("Non hai i permessi per spostare questo evento. Contatta un amministratore.");
                info.revert();
                return;
            }
            const event = info.event;
            const eventToUpdateRef = ref(database, `calendarEvents/${event.id}`);
            update(eventToUpdateRef, {
                start: event.start.toISOString(),
                end: event.end ? event.end.toISOString() : null
            });
        },
        
        eventDidMount: (info) => {
            const room = info.event.extendedProps.room;
            if (room) {
                const titleEl = info.el.querySelector('.fc-event-title');
                if (titleEl) {
                    const roomEl = document.createElement('div');
                    roomEl.style.fontSize = '0.75em';
                    roomEl.style.marginTop = '2px';
                    roomEl.style.opacity = '0.8';
                    roomEl.innerHTML = `📍 ${room}`;
                    titleEl.parentNode.appendChild(roomEl);
                }
            }
        }
    });

    calendar.render();

    // ==========================================================
    // --- BLOCCO CARICAMENTO MEMBRI (CORRETTO) ---
    // ==========================================================
    onValue(membersRef, (snapshot) => {
        // 1. Prendiamo i dati come OGGETTO
        const membersObject = snapshot.val() || {};
        
        // 2. Trasformiamo l'oggetto in un array di [uid, {name: "...", ...}]
        const allMemberEntries = Object.entries(membersObject);
        
        participantsContainer.innerHTML = '';
        if (allMemberEntries.length > 0) {
            
            // 3. Iteriamo sul nuovo array
            allMemberEntries.forEach(([uid, member]) => {
                // 'uid' è la chiave (es. "eb3RJKU...")
                // 'member' è l'oggetto (es. { name: "simone", ... })

                const div = document.createElement('div');
                div.className = 'flex items-center';
                
                // 4. Usiamo l'UID per l'ID e member.name per il testo e il valore
                div.innerHTML = `
                    <input id="part-${uid}" type="checkbox" value="${member.name}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                    <label for="part-${uid}" class="ml-2 block text-sm text-gray-900">${member.name}</label>
                `;
                participantsContainer.appendChild(div);
            });
        } else {
            participantsContainer.innerHTML = '<p class="text-gray-400">Nessun membro trovato.</p>';
        }
    });
    // ==========================================================
    // --- FINE BLOCCO CORRETTO ---
    // ==========================================================

    // Carica gli eventi da Firebase
    onValue(eventsRef, (snapshot) => {
        const allEvents = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                allEvents.push({ id: child.key, ...child.val() });
            });
        }
        calendar.removeAllEvents();
        calendar.addEventSource(allEvents);
    });

    // --- GESTIONE DEI PULSANTI ---

    saveEventBtn.addEventListener('click', () => {
        const title = eventTitleInput.value.trim();
        const start = eventStartInput.value;
        const end = eventEndInput.value;
        const color = eventPrioritySelect.value;
        const room = eventRoomSelect.value;
        const description = eventDescriptionInput.value.trim();
        const participants = Array.from(participantsContainer.querySelectorAll('input:checked')).map(cb => cb.value);

        if (!title || !start) {
            alert("Il titolo e la data di inizio sono obbligatori.");
            return;
        }

        const eventData = {
            title, start, end, room, participants, description,
            backgroundColor: color,
            borderColor: color,
            createdBy: currentUser.uid,
            requesterEmail: currentUser.email
        };

        if (currentUser.role === 'admin' || currentUser.role === 'calendar_admin') {
            if (currentEventInfo && currentEventInfo.isNew) {
                const newEventRef = push(eventsRef);
                set(newEventRef, eventData);
            } else if (currentEventInfo && !currentEventInfo.isNew) {
                const eventToUpdateRef = ref(database, `calendarEvents/${currentEventInfo.id}`);
                set(eventToUpdateRef, eventData);
            }
            alert('Evento salvato con successo.');
        } else {
            if (currentEventInfo && !currentEventInfo.isNew) {
                alert("Non hai i permessi per modificare un evento. Puoi solo crearne di nuovi.");
                return;
            }
            const newPendingRef = push(pendingEventsRef);
            set(newPendingRef, eventData);
            alert('Richiesta di evento inviata per approvazione!');
        }
        
        closeModal();
    });

    deleteEventBtn.addEventListener('click', () => {
        if (currentEventInfo && !currentEventInfo.isNew && confirm("Sei sicuro di voler eliminare questo evento?")) {
            const eventToDeleteRef = ref(database, `calendarEvents/${currentEventInfo.id}`);
            remove(eventToDeleteRef);
            closeModal();
        }
    });
    
    addEventExternBtn.addEventListener('click', () => {
        openModalForNewEvent({});
    });

    cancelEventBtn.addEventListener('click', closeModal);
}

// --- PUNTO DI INGRESSO DELLO SCRIPT ---
// Aspetta il segnale da auth-guard.js prima di inizializzare tutto.
document.addEventListener('authReady', () => {
    // Aggiungi un controllo per assicurarti che l'elemento esista prima di procedere
    if (document.getElementById('calendar')) {
        initializeCalendar();
    }
});
