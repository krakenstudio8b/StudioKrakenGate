// realtime-listener.js
// Listener Firebase per notifiche in tempo reale

const firebaseService = require('./firebase-service');
const formatter = require('./message-formatter');

let sendMessageFn = null;
let previousTasks = null; // Cache dei task precedenti per rilevare cambiamenti

/**
 * Inizializza i listener real-time
 */
function initRealtimeListeners(sendMessage) {
    sendMessageFn = sendMessage;

    // Carica stato iniziale senza inviare notifiche
    firebaseService.onValueChange('tasks', (data) => {
        const currentTasks = normalizeTasks(data);

        if (previousTasks === null) {
            // Prima lettura: salva lo stato senza notificare
            previousTasks = currentTasks;
            console.log(`[Realtime] Stato iniziale caricato: ${currentTasks.length} task`);
            return;
        }

        // Confronta con stato precedente
        detectChanges(previousTasks, currentTasks);
        previousTasks = currentTasks;
    });

    console.log('[Realtime] Listener attivi su Firebase');
}

/**
 * Normalizza i task da Firebase (può essere array o oggetto)
 */
function normalizeTasks(data) {
    if (Array.isArray(data)) return data.filter(Boolean);
    if (data && typeof data === 'object') return Object.values(data);
    return [];
}

/**
 * Rileva cambiamenti tra vecchio e nuovo stato
 */
async function detectChanges(oldTasks, newTasks) {
    const oldMap = new Map(oldTasks.map(t => [t.id, t]));
    const newMap = new Map(newTasks.map(t => [t.id, t]));

    for (const [id, newTask] of newMap) {
        const oldTask = oldMap.get(id);

        if (!oldTask) {
            // Nuovo task creato
            await handleNewTask(newTask);
            continue;
        }

        // Cambio di stato
        if (oldTask.status !== newTask.status) {
            await handleStatusChange(newTask, oldTask.status, newTask.status);
        }

        // Nuovi assegnati
        const oldAssignees = new Set(oldTask.assignedTo || []);
        const newAssignees = newTask.assignedTo || [];
        const addedAssignees = newAssignees.filter(a => !oldAssignees.has(a));
        if (addedAssignees.length > 0) {
            await handleNewAssignment(newTask, addedAssignees);
        }
    }
}

/**
 * Gestisci nuovo task creato
 */
async function handleNewTask(task) {
    // Notifica solo se il task ha assegnati
    if (!task.assignedTo || task.assignedTo.length === 0) return;

    try {
        console.log(`[Realtime] Nuovo task: ${task.title}`);
        const message = formatter.formatNewTaskAlert(task);
        await sendMessageFn(message);
    } catch (error) {
        console.error('[Realtime] Errore notifica nuovo task:', error.message);
    }
}

/**
 * Gestisci cambio stato
 */
async function handleStatusChange(task, oldStatus, newStatus) {
    try {
        console.log(`[Realtime] Cambio stato: ${task.title} (${oldStatus} → ${newStatus})`);

        let message;
        if (newStatus === 'done') {
            message = formatter.formatTaskCompleted(task);
        } else {
            message = formatter.formatStatusChange(task, oldStatus, newStatus);
        }

        await sendMessageFn(message);
    } catch (error) {
        console.error('[Realtime] Errore notifica cambio stato:', error.message);
    }
}

/**
 * Gestisci nuova assegnazione a un task esistente
 */
async function handleNewAssignment(task, newAssignees) {
    try {
        console.log(`[Realtime] Nuovi assegnati a "${task.title}": ${newAssignees.join(', ')}`);
        const message = `👥 *NUOVA ASSEGNAZIONE*\n\n` +
            `*${newAssignees.join(', ')}* ${newAssignees.length === 1 ? 'è stato aggiunto' : 'sono stati aggiunti'} al task:\n` +
            `📋 *${task.title}*\n` +
            `${task.dueDate ? `📅 Scadenza: ${formatter.formatDate(task.dueDate)}` : ''}`;
        await sendMessageFn(message);
    } catch (error) {
        console.error('[Realtime] Errore notifica assegnazione:', error.message);
    }
}

module.exports = {
    initRealtimeListeners
};
