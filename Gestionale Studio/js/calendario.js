import { database } from './firebase-config.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

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
        currentEventInfo = null; // Resetta l'evento corrente
    };

    const saveDataToFirebase = () => {
        set(eventsRef, allEvents);
    };
    
    // Inizializzazione di FullCalendar
    const calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'it',
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
        height: '100%', // Fa sì che il calendario riempia il contenitore
        editable: true,
        selectable: true,
        
        select: (info) => {
            modalTitle.textContent = 'Aggiungi Evento';
            eventTitleInput.value = '';
            
            const startDate = new Date(info.startStr);
            startDate.setMinutes(startDate.getMinutes() - startDate.getTimezoneOffset());
            eventStartInput.value = startDate.toISOString().slice(0, 16);

            if(info.endStr) {
                const endDate = new Date(info.endStr);
                endDate.setMinutes(endDate.getMinutes() - endDate.getTimezoneOffset());
                eventEndInput.value = endDate.toISOString().slice(0, 16);
            } else {
                eventEndInput.value = eventStartInput.value;
            }

            eventPrioritySelect.value = '#3b82f6'; // Default Bassa Priorità
            eventRoomSelect.value = ''; // Nessuna sala
            participantsContainer.querySelectorAll('input').forEach(cb => cb.checked = false); // Deseleziona tutti
            
            deleteEventBtn.classList.add('hidden');
            currentEventInfo = { id: null, isNew: true };
            openModal();
        },

        eventClick: (info) => {
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
            const event = info.event;
            const eventIndex = allEvents.findIndex(e => e.id === event.id);
            if (eventIndex !== -1) {
                allEvents[eventIndex].start = event.start.toISOString();
                allEvents[eventIndex].end = event.end ? event.end.toISOString() : event.start.toISOString();
                saveDataToFirebase();
            }
        },
        
        // Formatta il titolo per mostrare anche la sala
        eventContent: function(arg) {
            const room = arg.event.extendedProps.room;
            const title = arg.event.title;
            if (room) {
                return { html: `<div class="fc-event-main-frame">
                                    <div class="fc-event-title-container">
                                        <div class="fc-event-title">${title}</div>
                                    </div>
                                    <div class="fc-event-room">${room}</div>
                                </div>` };
            }
        }
    });

    calendar.render();

    // Carica i membri per la lista partecipanti
    onValue(membersRef, (snapshot) => {
        allMembers = snapshot.val() || [];
        participantsContainer.innerHTML = '';
        allMembers.forEach(member => {
            const div = document.createElement('div');
            div.className = 'flex items-center';
            div.innerHTML = `
                <input id="part-${member}" type="checkbox" value="${member}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                <label for="part-${member}" class="ml-2 block text-sm text-gray-900">${member}</label>
            `;
            participantsContainer.appendChild(div);
        });
    });

    // Carica gli eventi da Firebase
    onValue(eventsRef, (snapshot) => {
        allEvents = snapshot.val() || [];
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
        const participants = Array.from(participantsContainer.querySelectorAll('input:checked')).map(cb => cb.value);

        if (!title || !start) {
            alert("Il titolo e la data di inizio sono obbligatori.");
            return;
        }

        const eventData = {
            title, start, end, room, participants,
            color: color, // Per la retrocompatibilità
            backgroundColor: color,
            borderColor: color
        };

        if (currentEventInfo && currentEventInfo.isNew) {
            eventData.id = Date.now().toString();
            allEvents.push(eventData);
        } else if (currentEventInfo && !currentEventInfo.isNew) {
            const eventIndex = allEvents.findIndex(e => e.id === currentEventInfo.id);
            if (eventIndex !== -1) {
                eventData.id = currentEventInfo.id;
                allEvents[eventIndex] = eventData;
            }
        }
        
        saveDataToFirebase();
        closeModal();
    });

    deleteEventBtn.addEventListener('click', () => {
        if (currentEventInfo && !currentEventInfo.isNew && confirm("Sei sicuro di voler eliminare questo evento?")) {
            allEvents = allEvents.filter(e => e.id !== currentEventInfo.id);
            saveDataToFirebase();
            closeModal();
        }
    });
    
    addEventExternBtn.addEventListener('click', () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const fakeInfo = { startStr: now.toISOString() };
        calendar.select(fakeInfo); // Simula una selezione sulla data di oggi
    });

    cancelEventBtn.addEventListener('click', closeModal);
});
