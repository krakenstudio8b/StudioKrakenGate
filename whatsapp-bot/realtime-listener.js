// realtime-listener.js

const firebaseService = require('./firebase-service');
const formatter       = require('./message-formatter');

let sendMessageFn = null;
let previousTasks = null;
let eventCache    = {}; // eventId → title

function initRealtimeListeners(sendMessage) {
    sendMessageFn = sendMessage;

    // Carica cache eventi al boot
    firebaseService.getCalendarEvents()
        .then(events => {
            events.forEach(e => { eventCache[e.id] = e.title; });
            console.log(`[Realtime] Cache eventi caricata: ${events.length} eventi`);
        })
        .catch(err => console.error('[Realtime] Errore caricamento eventi:', err.message));

    // Mantieni cache eventi aggiornata in real-time
    firebaseService.onValueChange('calendarEvents', (data) => {
        eventCache = {};
        if (data) Object.entries(data).forEach(([key, val]) => { eventCache[key] = val.title; });
    });

    // Ascolta i task
    firebaseService.onValueChange('tasks', (data) => {
        const currentTasks = normalizeTasks(data);

        if (previousTasks === null) {
            previousTasks = currentTasks;
            console.log(`[Realtime] Stato iniziale caricato: ${currentTasks.length} task`);
            return;
        }

        detectChanges(previousTasks, currentTasks);
        previousTasks = currentTasks;
    });

    console.log('[Realtime] Listener attivi su Firebase');
}

function normalizeTasks(data) {
    if (Array.isArray(data))                 return data.filter(Boolean);
    if (data && typeof data === 'object')    return Object.values(data);
    return [];
}

function getEventName(task) {
    return task.calendarEventId ? (eventCache[task.calendarEventId] || null) : null;
}

async function detectChanges(oldTasks, newTasks) {
    const oldMap = new Map(oldTasks.map(t => [t.id, t]));
    const newMap = new Map(newTasks.map(t => [t.id, t]));

    for (const [id, newTask] of newMap) {
        const oldTask = oldMap.get(id);

        if (!oldTask) {
            await handleNewTask(newTask);
            continue;
        }

        if (oldTask.status !== newTask.status) {
            await handleStatusChange(newTask, oldTask.status, newTask.status);
        }

        const oldAssignees = new Set(oldTask.assignedTo || []);
        const addedAssignees = (newTask.assignedTo || []).filter(a => !oldAssignees.has(a));
        if (addedAssignees.length > 0) {
            await handleNewAssignment(newTask, addedAssignees);
        }
    }
}

async function handleNewTask(task) {
    if (!task.assignedTo || task.assignedTo.length === 0) return;
    try {
        const message = formatter.formatNewTaskAlert(task, getEventName(task));
        await sendMessageFn(message);
    } catch (error) {
        console.error('[Realtime] Errore notifica nuovo task:', error.message);
    }
}

async function handleStatusChange(task, oldStatus, newStatus) {
    try {
        const eventName = getEventName(task);
        const message = newStatus === 'done'
            ? formatter.formatTaskCompleted(task, eventName)
            : formatter.formatStatusChange(task, oldStatus, newStatus, eventName);
        await sendMessageFn(message);
    } catch (error) {
        console.error('[Realtime] Errore notifica cambio stato:', error.message);
    }
}

async function handleNewAssignment(task, newAssignees) {
    try {
        const message = formatter.formatNewAssignment(task, newAssignees, getEventName(task));
        await sendMessageFn(message);
    } catch (error) {
        console.error('[Realtime] Errore notifica assegnazione:', error.message);
    }
}

module.exports = { initRealtimeListeners };
