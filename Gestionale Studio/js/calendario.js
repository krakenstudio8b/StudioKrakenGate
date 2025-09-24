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
    const eventColorInput = document.getElementById('event-color');
    const saveEventBtn = document.getElementById('save-event-btn');
    const deleteEventBtn = document.getElementById('delete-event-btn');
    const cancelEventBtn = document.getElementById('cancel-event-btn');

    // Riferimento a Firebase
    const eventsRef = ref(database, 'calendarEvents');
    let allEvents = [];
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
        locale: 'it', // Imposta la lingua italiana
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
        editable: true,    // Permette di trascinare gli eventi
        selectable: true,  // Permette di selezionare date
        
        // --- GESTIONE DEGLI EVENTI DEL CALENDARIO ---

        // Quando si seleziona una data o un intervallo
        select: (info) => {
            modalTitle.textContent = 'Aggiungi Evento';
            eventTitleInput.value = '';
            // Formatta le date per l'input datetime-local
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

            eventColorInput.value = '#3b82f6'; // Colore di default
            deleteEventBtn.classList.add('hidden');
            currentEventInfo = { id: null, isNew: true };
            openModal();
        },

        // Quando si clicca su un evento esistente
        eventClick: (info) => {
            modalTitle.textContent = 'Modifica Evento';
            const event = info.event;
            
            eventTitleInput.value = event.title;
            const startDate = new Date(event.start);
            startDate.setMinutes(startDate.getMinutes() - startDate.getTimezoneOffset());
            eventStartInput.value = startDate.toISOString().slice(0, 16);

            const endDate = event.end ? new Date(event.end) : startDate;
            if(event.end) endDate.setMinutes(endDate.getMinutes() - endDate.getTimezoneOffset());
            eventEndInput.value = endDate.toISOString().slice(0, 16);

            eventColorInput.value = event.backgroundColor || '#3b82f6';
            deleteEventBtn.classList.remove('hidden');
            currentEventInfo = { id: event.id, isNew: false };
            openModal();
        },

        // Quando un evento viene trascinato su un'altra data
        eventDrop: (info) => {
            const event = info.event;
            const eventIndex = allEvents.findIndex(e => e.id === event.id);
            if (eventIndex !== -1) {
                allEvents[eventIndex].start = event.start.toISOString();
                allEvents[eventIndex].end = event.end ? event.end.toISOString() : event.start.toISOString();
                saveDataToFirebase();
            }
        }
    });

    calendar.render();

    // Carica gli eventi da Firebase
    onValue(eventsRef, (snapshot) => {
        allEvents = snapshot.val() || [];
        calendar.removeAllEvents();
        calendar.addEventSource(allEvents);
    });

    // --- GESTIONE DEI PULSANTI DEL MODALE ---

    saveEventBtn.addEventListener('click', () => {
        const title = eventTitleInput.value.trim();
        const start = eventStartInput.value;
        const end = eventEndInput.value;
        const color = eventColorInput.value;

        if (!title || !start) {
            alert("Il titolo e la data di inizio sono obbligatori.");
            return;
        }

        if (currentEventInfo && currentEventInfo.isNew) {
            // Aggiungi nuovo evento
            const newEvent = {
                id: Date.now().toString(),
                title,
                start,
                end,
                color,
                backgroundColor: color, // Proprietà usata da FullCalendar
                borderColor: color    // Proprietà usata da FullCalendar
            };
            allEvents.push(newEvent);
        } else if (currentEventInfo && !currentEventInfo.isNew) {
            // Modifica evento esistente
            const eventIndex = allEvents.findIndex(e => e.id === currentEventInfo.id);
            if (eventIndex !== -1) {
                allEvents[eventIndex] = {
                    ...allEvents[eventIndex],
                    title,
                    start,
                    end,
                    color,
                    backgroundColor: color,
                    borderColor: color
                };
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

    cancelEventBtn.addEventListener('click', closeModal);
});
