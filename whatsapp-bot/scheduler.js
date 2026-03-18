// scheduler.js

const cron            = require('node-cron');
const firebaseService = require('./firebase-service');
const formatter       = require('./message-formatter');

let sendMessageFn = null;

function initScheduler(sendMessage) {
    sendMessageFn = sendMessage;

    const hour   = process.env.DAILY_REMINDER_HOUR   || '9';
    const minute = process.env.DAILY_REMINDER_MINUTE || '0';
    const tz     = process.env.TZ || 'Europe/Rome';

    // Reminder giornaliero (lun-sab)
    cron.schedule(`${minute} ${hour} * * 1-6`, async () => {
        console.log('[Scheduler] Invio reminder giornaliero...');
        await sendDailyReminder();
    }, { timezone: tz });

    // Check scadenze domani — ogni sera alle 18:30 (lun-ven)
    cron.schedule('30 18 * * 1-5', async () => {
        console.log('[Scheduler] Check task in scadenza domani...');
        await sendDeadlineWarnings();
    }, { timezone: tz });

    // Report settimanale — ogni lunedì alle 9:00
    cron.schedule(`${minute} ${hour} * * 1`, async () => {
        console.log('[Scheduler] Invio report settimanale...');
        await sendWeeklyReport();
    }, { timezone: tz });

    console.log(`[Scheduler] Reminder giornaliero → ${hour}:${String(minute).padStart(2,'0')} lun-sab`);
    console.log(`[Scheduler] Avvisi scadenze      → 18:30 lun-ven`);
    console.log(`[Scheduler] Report settimanale   → lunedì ${hour}:${String(minute).padStart(2,'0')}`);
}

async function sendDailyReminder() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const [tasksDueToday, overdueTasks, checklistToday, eventsToday] = await Promise.all([
            firebaseService.getTasksDueToday(),
            firebaseService.getOverdueTasks(),
            firebaseService.getChecklistItemsDueToday(),
            firebaseService.getEventsForDate(today)
        ]);
        const [enrichedToday, enrichedOverdue] = await Promise.all([
            firebaseService.enrichTasksWithEvents(tasksDueToday),
            firebaseService.enrichTasksWithEvents(overdueTasks)
        ]);
        const message = formatter.formatDailyReminder(
            firebaseService.groupTasksByMember(enrichedToday),
            firebaseService.groupTasksByMember(enrichedOverdue),
            today,
            checklistToday,
            eventsToday
        );
        await sendMessageFn(message);
        console.log('[Scheduler] Reminder giornaliero inviato');
    } catch (error) {
        console.error('[Scheduler] Errore reminder giornaliero:', error.message);
    }
}

async function sendDeadlineWarnings() {
    try {
        const tasksDueTomorrow = await firebaseService.getTasksDueTomorrow();
        if (tasksDueTomorrow.length === 0) return;
        const enriched = await firebaseService.enrichTasksWithEvents(tasksDueTomorrow);
        const message  = formatter.formatDeadlineWarnings(enriched);
        if (message) await sendMessageFn(message);
        console.log(`[Scheduler] Avvisi scadenza inviati: ${tasksDueTomorrow.length} task`);
    } catch (error) {
        console.error('[Scheduler] Errore avvisi scadenza:', error.message);
    }
}

async function sendWeeklyOverview() {
    try {
        const [weekTasks, overdueTasks, checklistWeek] = await Promise.all([
            firebaseService.getTasksDueThisWeek(),
            firebaseService.getOverdueTasks(),
            firebaseService.getChecklistItemsDueThisWeek()
        ]);
        const [enrichedWeek, enrichedOverdue] = await Promise.all([
            firebaseService.enrichTasksWithEvents(weekTasks),
            firebaseService.enrichTasksWithEvents(overdueTasks)
        ]);
        const message = formatter.formatWeeklyOverview(enrichedWeek, enrichedOverdue, checklistWeek);
        await sendMessageFn(message);
    } catch (error) {
        console.error('[Scheduler] Errore riepilogo settimanale:', error.message);
    }
}

async function sendMonthlyOverview() {
    try {
        const [monthTasks, overdueTasks] = await Promise.all([
            firebaseService.getTasksThisMonth(),
            firebaseService.getOverdueTasks()
        ]);
        const [enrichedMonth, enrichedOverdue] = await Promise.all([
            firebaseService.enrichTasksWithEvents(monthTasks),
            firebaseService.enrichTasksWithEvents(overdueTasks)
        ]);
        const message = formatter.formatMonthlyOverview(enrichedMonth, enrichedOverdue);
        await sendMessageFn(message);
    } catch (error) {
        console.error('[Scheduler] Errore riepilogo mensile:', error.message);
    }
}

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
        console.error('[Scheduler] Errore report settimanale:', error.message);
    }
}

module.exports = {
    initScheduler,
    sendDailyReminder,
    sendWeeklyOverview,
    sendMonthlyOverview,
    sendWeeklyReport
};
