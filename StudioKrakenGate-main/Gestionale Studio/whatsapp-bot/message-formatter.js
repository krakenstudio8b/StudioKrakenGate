// message-formatter.js
// Formattazione messaggi WhatsApp per il bot

const PRIORITY_EMOJI = {
    high: '🔴',
    medium: '🟠',
    low: '🔵'
};

const PRIORITY_LABEL = {
    high: 'ALTA',
    medium: 'MEDIA',
    low: 'BASSA'
};

/**
 * Formatta la data in italiano (es. "10 febbraio 2026")
 */
function formatDate(dateStr) {
    if (!dateStr) return 'Nessuna scadenza';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Calcola i giorni di ritardo
 */
function daysOverdue(dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate + 'T00:00:00');
    const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
    return diff;
}

/**
 * Formatta un singolo task come stringa
 */
function formatTask(task) {
    const emoji = PRIORITY_EMOJI[task.priority] || '⚪';
    const priority = PRIORITY_LABEL[task.priority] || '';
    const dueStr = task.dueDate ? ` - Scadenza: ${formatDate(task.dueDate)}` : '';

    let line = `${emoji} *${task.title}* (${priority})${dueStr}`;

    // Checklist progress
    if (task.checklist && task.checklist.length > 0) {
        const done = task.checklist.filter(i => i.done).length;
        line += `\n   Checklist: ${done}/${task.checklist.length} completati`;
    }

    return line;
}

/**
 * Messaggio di reminder giornaliero
 */
function formatDailyReminder(tasksByMember, overdueByMember, todayDate) {
    const dateStr = formatDate(todayDate);
    let msg = `📋 *RIEPILOGO GIORNALIERO*\n📅 ${dateStr}\n`;
    msg += '━━━━━━━━━━━━━━━━━━━━\n';

    let hasContent = false;

    // Task in scadenza oggi per membro
    for (const [member, tasks] of Object.entries(tasksByMember)) {
        if (tasks.length === 0) continue;
        hasContent = true;
        msg += `\n👤 *${member}* - ${tasks.length} task oggi:\n`;
        tasks.forEach(task => {
            msg += `  ${formatTask(task)}\n`;
        });
    }

    // Task scaduti
    for (const [member, tasks] of Object.entries(overdueByMember)) {
        if (tasks.length === 0) continue;
        hasContent = true;
        msg += `\n⚠️ *${member}* - ${tasks.length} task SCADUTI:\n`;
        tasks.forEach(task => {
            const days = daysOverdue(task.dueDate);
            msg += `  🔴 *${task.title}* - scaduto da ${days} giorn${days === 1 ? 'o' : 'i'}\n`;
        });
    }

    if (!hasContent) {
        msg += '\n✅ Nessun task in scadenza oggi e nessun arretrato!\nBuona giornata team! 💪';
    } else {
        msg += '\n━━━━━━━━━━━━━━━━━━━━\nDai che spacchiamo! 💪';
    }

    return msg;
}

/**
 * Messaggio per nuovo task assegnato
 */
function formatNewTaskAlert(task) {
    const emoji = PRIORITY_EMOJI[task.priority] || '⚪';
    const assignees = (task.assignedTo || []).join(', ');
    const owner = task.owner ? `\n👑 Responsabile: *${task.owner}*` : '';
    const dueStr = task.dueDate ? `\n📅 Scadenza: ${formatDate(task.dueDate)}` : '';

    return `🆕 *NUOVO TASK ASSEGNATO*\n\n` +
        `${emoji} *${task.title}*\n` +
        `${task.description ? task.description + '\n' : ''}` +
        `👥 Assegnato a: *${assignees || 'Nessuno'}*` +
        owner +
        dueStr;
}

/**
 * Messaggio per task che sta per scadere (tra 1 giorno)
 */
function formatDeadlineWarning(task) {
    const assignees = (task.assignedTo || []).join(', ');
    return `⏰ *PROMEMORIA SCADENZA*\n\n` +
        `Il task *${task.title}* scade *domani*!\n` +
        `👥 Assegnato a: *${assignees || 'Nessuno'}*\n` +
        `📊 Stato: ${task.status === 'todo' ? 'Da fare' : 'In corso'}`;
}

/**
 * Messaggio per cambio stato task
 */
function formatStatusChange(task, oldStatus, newStatus) {
    const statusLabels = {
        todo: 'Da Fare ⬜',
        inprogress: 'In Corso 🔄',
        done: 'Completato ✅'
    };
    const oldLabel = statusLabels[oldStatus] || oldStatus;
    const newLabel = statusLabels[newStatus] || newStatus;

    return `🔄 *AGGIORNAMENTO TASK*\n\n` +
        `*${task.title}*\n` +
        `${oldLabel} → ${newLabel}\n` +
        `${task.owner ? `👑 ${task.owner}` : ''}`;
}

/**
 * Messaggio per task completato
 */
function formatTaskCompleted(task) {
    return `✅ *TASK COMPLETATO!*\n\n` +
        `*${task.title}*\n` +
        `${task.owner ? `Completato da: *${task.owner}*` : ''}\n` +
        `Ottimo lavoro! 🎉`;
}

module.exports = {
    formatDailyReminder,
    formatNewTaskAlert,
    formatDeadlineWarning,
    formatStatusChange,
    formatTaskCompleted,
    formatTask,
    formatDate,
    daysOverdue
};
