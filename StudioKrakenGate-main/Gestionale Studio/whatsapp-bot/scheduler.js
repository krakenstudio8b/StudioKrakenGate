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

    console.log(`[Scheduler] Reminder giornaliero programmato alle ${hour}:${minute.padStart(2, '0')} (lun-sab)`);
    console.log('[Scheduler] Check scadenze programmato alle 18:00 (lun-ven)');
}

/**
 * Invia il riepilogo giornaliero al gruppo
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
 * Invia alert per task in scadenza domani
 */
async function sendDeadlineWarnings() {
    try {
        const tasksDueTomorrow = await firebaseService.getTasksDueTomorrow();

        if (tasksDueTomorrow.length === 0) return;

        for (const task of tasksDueTomorrow) {
            const message = formatter.formatDeadlineWarning(task);
            await sendMessageFn(message);
            // Pausa tra messaggi per non fare spam
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`[Scheduler] Inviati ${tasksDueTomorrow.length} avvisi scadenza`);
    } catch (error) {
        console.error('[Scheduler] Errore invio avvisi scadenza:', error.message);
    }
}

/**
 * Invia il riepilogo settimanale al gruppo
 */
async function sendWeeklyOverview() {
    try {
        const [weekTasks, overdueTasks] = await Promise.all([
            firebaseService.getTasksDueThisWeek(),
            firebaseService.getOverdueTasks()
        ]);

        const tasksByMember = firebaseService.groupTasksByMember(weekTasks);
        const overdueByMember = firebaseService.groupTasksByMember(overdueTasks);

        const message = formatter.formatWeeklyOverview(tasksByMember, overdueByMember);
        await sendMessageFn(message);

        console.log('[Scheduler] Riepilogo settimanale inviato');
    } catch (error) {
        console.error('[Scheduler] Errore invio riepilogo settimanale:', error.message);
    }
}

/**
 * Invia il riepilogo mensile al gruppo
 */
async function sendMonthlyOverview() {
    try {
        const [monthTasks, overdueTasks] = await Promise.all([
            firebaseService.getTasksThisMonth(),
            firebaseService.getOverdueTasks()
        ]);

        const tasksByMember = firebaseService.groupTasksByMember(monthTasks);
        const overdueByMember = firebaseService.groupTasksByMember(overdueTasks);

        const message = formatter.formatMonthlyOverview(tasksByMember, overdueByMember);
        await sendMessageFn(message);

        console.log('[Scheduler] Riepilogo mensile inviato');
    } catch (error) {
        console.error('[Scheduler] Errore invio riepilogo mensile:', error.message);
    }
}

module.exports = {
    initScheduler,
    sendDailyReminder,
    sendWeeklyOverview,
    sendMonthlyOverview
};
