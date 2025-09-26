import { database } from './firebase-config.js';
import { ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';

document.addEventListener('DOMContentLoaded', () => {
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
    const membersRef = ref(database, 'members');
    let allEvents = [];
    let allMembers = [];
    let currentEventInfo = null;

    // Funzioni per gestire il modale
    const openModal = () => eventModal.classList.remove('hidden');
    const closeModal = () => {
        eventModal.classList.add('hidden');
        currentEventInfo = null;
    };

    const saveDataToFirebase = () => {
        set(eventsRef, allEvents);
    };

    const openModalForNewEvent = (info) => {
        modalTitle.textContent = 'Aggiungi Evento';
        eventTitleInput.value = '';
        
        const startDate = info.start ? new Date(info.start) : new Date();
        startDate.setMinutes(startDate.getMinutes() - startDate.getTimezoneOffset());
        eventStartInput.value = startDate.toISOString().slice(0, 16);

        const endDate = info.end ? new Date(info.end) : startDate;
        if(info.end) endDate.setMinutes(endDate.getMinutes() - endDate.getTimezoneOffset());
        eventEndInput.value = endDate.toISOString().slice(0, 16);
        
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
        firstDay: 1, // Imposta Lunedì come primo giorno della settimana
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
        },
        buttonText: {
            today: 'Oggi',
            month: 'Mese',
            week: 'Settimana',
            day: 'Giorno',
            list: 'Agenda'
        },
        height: '100%',
        editable: true,
        selectable: true,
        
        select: (info) => {
            openModalForNewEvent({ start: info.startStr, end: info.endStr });
        },

        eventClick: (info) => {
            // Gli utenti normali non possono modificare gli eventi esistenti dal calendario
            if (currentUser.role === 'user') {
                alert("Non hai i permessi per modificare questo evento. Contatta un amministratore.");
                return;
            }

            modalTitle.textContent = 'Modifica Evento';
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

            deleteEventBtn.classList.remove('hidden');
            currentEventInfo = { id: event.id, isNew: false };
            openModal();
        },

        eventDrop: (info) => {
            if (currentUser.role === 'user') {
                alert("Non hai i permessi per spostare questo evento. Contatta un amministratore.");
                info.revert(); // Annulla lo spostamento
                return;
            }
            const event = info.event;
            const eventIndex = allEvents.findIndex(e => e.id === event.id);
            if (eventIndex !== -1) {
                allEvents[eventIndex].start = event.start.toISOString();
                allEvents[eventIndex].end = event.end ? event.end.toISOString() : null;
                saveDataToFirebase();
            }
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

    // Carica i membri per la lista partecipanti
    onValue(membersRef, (snapshot) => {
        allMembers = snapshot.val() || [];
        participantsContainer.innerHTML = '';
        if (allMembers.length > 0) {
            allMembers.forEach(member => {
                const div = document.createElement('div');
                div.className = 'flex items-center';
                div.innerHTML = `
                    <input id="part-${member}" type="checkbox" value="${member}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                    <label for="part-${member}" class="ml-2 block text-sm text-gray-900">${member}</label>
                `;
                participantsContainer.appendChild(div);
            });
        } else {
            participantsContainer.innerHTML = '<p class="text-gray-400">Nessun membro trovato.</p>';
        }
    });

    // Carica gli eventi da Firebase
    onValue(eventsRef, (snapshot) => {
        allEvents = [];
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
            const pendingRef = ref(database, 'pendingCalendarEvents');
            const newPendingRef = push(pendingRef);
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
});
