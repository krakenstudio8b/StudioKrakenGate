// scheduler.js
// Cron jobs per reminder giornalieri e controlli periodici

const cron = require('node-cron');
const firebaseService = require('./firebase-service');
const formatter = require('./message-formatter');

let sendMessageFn = null;

/**
 * Inizializza lo scheduler con la funzione per inviare messaggi
 */
function initScheduler(sendMessage) {
    sendMessageFn = sendMessage;

    const hour = process.env.DAILY_REMINDER_HOUR || '9';
    const minute = process.env.DAILY_REMINDER_MINUTE || '0';

    // Reminder giornaliero (lun-sab)
    cron.schedule(`${minute} ${hour} * * 1-6`, async () => {
        console.log('[Scheduler] Invio reminder giornaliero...');
        await sendDailyReminder();
    }, {
        timezone: process.env.TZ || 'Europe/Rome'
    });

    // Check scadenze domani - ogni sera alle 18:00 (lun-ven)
    cron.schedule('0 18 * * 1-5', async () => {
        console.log('[Scheduler] Check task in scadenza domani...');
        await sendDeadlineWarnings();
    }, {
        timezone: process.env.TZ || 'Europe/Rome'
    });

    // Report settimanale - ogni lunedi alle 9:00
    cron.schedule('0 9 * * 1', async () => {
        console.log('[Scheduler] Invio report settimanale...');
        await sendWeeklyReport();
    }, {
        timezone: process.env.TZ || 'Europe/Rome'
    });

    console.log(`[Scheduler] Reminder giornaliero programmato alle ${hour}:${minute.padStart(2, '0')} (lun-sab)`);
    console.log('[Scheduler] Check scadenze programmato alle 18:00 (lun-ven)');
    console.log('[Scheduler] Report settimanale programmato ogni lunedi alle 9:00');
}

/**
 * !oggi - Invia il riepilogo giornaliero
 */
async function sendDailyReminder() {
    try {
        const today = new Date().toISOString().split('T')[0];

        const [tasksDueToday, overdueTasks] = await Promise.all([
            firebaseService.getTasksDueToday(),
            firebaseService.getOverdueTasks()
        ]);

        const tasksByMember = firebaseService.groupTasksByMember(tasksDueToday);
        const overdueByMember = firebaseService.groupTasksByMember(overdueTasks);

        const message = formatter.formatDailyReminder(tasksByMember, overdueByMember, today);
        await sendMessageFn(message);

        console.log('[Scheduler] Reminder giornaliero inviato');
    } catch (error) {
        console.error('[Scheduler] Errore invio reminder:', error.message);
    }
}

/**
 * Alert scadenze domani
 */
async function sendDeadlineWarnings() {
    try {
        const tasksDueTomorrow = await firebaseService.getTasksDueTomorrow();

        if (tasksDueTomorrow.length === 0) return;

        for (const task of tasksDueTomorrow) {
            const message = formatter.formatDeadlineWarning(task);
            await sendMessageFn(message);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`[Scheduler] Inviati ${tasksDueTomorrow.length} avvisi scadenza`);
    } catch (error) {
        console.error('[Scheduler] Errore invio avvisi scadenza:', error.message);
    }
}

/**
 * !settimana - Invia riepilogo settimanale
 */
async function sendWeeklyOverview() {
    try {
        const [weekTasks, overdueTasks] = await Promise.all([
            firebaseService.getTasksDueThisWeek(),
            firebaseService.getOverdueTasks()
        ]);

        const message = formatter.formatWeeklyOverview(weekTasks, overdueTasks);
        await sendMessageFn(message);

        console.log('[Scheduler] Riepilogo settimanale inviato');
    } catch (error) {
        console.error('[Scheduler] Errore invio riepilogo settimanale:', error.message);
    }
}

/**
 * !mese - Invia riepilogo mensile
 */
async function sendMonthlyOverview() {
    try {
        const [monthTasks, overdueTasks] = await Promise.all([
            firebaseService.getTasksThisMonth(),
            firebaseService.getOverdueTasks()
        ]);

        const message = formatter.formatMonthlyOverview(monthTasks, overdueTasks);
        await sendMessageFn(message);

        console.log('[Scheduler] Riepilogo mensile inviato');
    } catch (error) {
        console.error('[Scheduler] Errore invio riepilogo mensile:', error.message);
    }
}

/**
 * !task nome - Invia task di una persona specifica
 */
async function sendPersonTasks(name) {
    try {
        const tasks = await firebaseService.getTasks();
        const nameLower = name.toLowerCase();

        const personTasks = tasks.filter(t =>
            t.status !== 'done' &&
            ((t.assignedTo || []).some(a => a.toLowerCase() === nameLower) ||
             (t.owner && t.owner.toLowerCase() === nameLower))
        );

        const today = new Date().toISOString().split('T')[0];
        const active = personTasks.filter(t => !t.dueDate || t.dueDate >= today);
        const overdue = personTasks.filter(t => t.dueDate && t.dueDate < today);

        const message = formatter.formatPersonTasks(name, active, overdue);
        await sendMessageFn(message);

        console.log(`[Scheduler] Task di ${name} inviati`);
    } catch (error) {
        console.error('[Scheduler] Errore invio task persona:', error.message);
    }
}

/**
 * Report settimanale (lunedi mattina)
 */
async function sendWeeklyReport() {
    try {
        const [completedTasks, overdueTasks, weekTasks] = await Promise.all([
            firebaseService.getTasksCompletedLastWeek(),
            firebaseService.getOverdueTasks(),
            firebaseService.getTasksDueThisWeek()
        ]);

        const message = formatter.formatWeeklyReport(completedTasks, overdueTasks, weekTasks);
        await sendMessageFn(message);

        console.log('[Scheduler] Report settimanale inviato');
    } catch (error) {
        console.error('[Scheduler] Errore invio report settimanale:', error.message);
    }
}

module.exports = {
    initScheduler,
    sendDailyReminder,
    sendWeeklyOverview,
    sendMonthlyOverview,
    sendPersonTasks,
    sendWeeklyReport
};
