// message-formatter.js
// Formattazione messaggi WhatsApp per il bot

const PRIORITY_EMOJI = {
    high: '🔴',
    medium: '🟠',
    low: '🔵'
};

/**
 * Formatta la data corta (es. "lun 10 feb")
 */
function formatDateShort(dateStr) {
    if (!dateStr) return 'N/D';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('it-IT', {
        weekday: 'short', day: 'numeric', month: 'short'
    });
}

/**
 * Formatta la data lunga (es. "10 febbraio 2026")
 */
function formatDate(dateStr) {
    if (!dateStr) return 'Nessuna scadenza';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('it-IT', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

/**
 * Calcola i giorni di ritardo
 */
function daysOverdue(dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate + 'T00:00:00');
    return Math.floor((today - due) / (1000 * 60 * 60 * 24));
}

/**
 * Formatta una riga task compatta
 */
function formatTaskLine(task) {
    const emoji = PRIORITY_EMOJI[task.priority] || '⚪';
    const date = formatDateShort(task.dueDate);
    return `${emoji} *${task.title}* - ${date}`;
}

/**
 * !oggi - Task in scadenza oggi
 */
function formatDailyReminder(tasksByMember, overdueByMember, todayDate) {
    let msg = `📋 *TASK DI OGGI* - ${formatDate(todayDate)}\n`;
    msg += '━━━━━━━━━━━━━━━━━━━━\n';

    let hasContent = false;

    for (const [member, tasks] of Object.entries(tasksByMember)) {
        if (tasks.length === 0) continue;
        hasContent = true;
        msg += `\n👤 *${member}*:\n`;
        tasks.forEach(t => { msg += `  ${formatTaskLine(t)}\n`; });
    }

    const overdueList = Object.entries(overdueByMember).filter(([, t]) => t.length > 0);
    if (overdueList.length > 0) {
        hasContent = true;
        msg += `\n⚠️ *SCADUTI:*\n`;
        for (const [member, tasks] of overdueList) {
            tasks.forEach(t => {
                const days = daysOverdue(t.dueDate);
                msg += `  🔴 *${t.title}* (${member}) - ${days}g di ritardo\n`;
            });
        }
    }

    if (!hasContent) {
        msg += '\n✅ Nessun task oggi e nessun arretrato!\nBuona giornata! 💪';
    }

    return msg;
}

/**
 * !settimana - Task in scadenza questa settimana (lista compatta)
 */
function formatWeeklyOverview(tasks, overdueTasks) {
    let msg = `📋 *SCADENZE SETTIMANA*\n`;
    msg += '━━━━━━━━━━━━━━━━━━━━\n';

    if (tasks.length === 0 && overdueTasks.length === 0) {
        msg += '\n✅ Nessun task in scadenza questa settimana!';
        return msg;
    }

    // Ordina per data
    tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    tasks.forEach(t => {
        const assignees = (t.assignedTo || []).join(', ');
        msg += `\n${formatTaskLine(t)}`;
        if (assignees) msg += `\n   👥 ${assignees}`;
    });

    if (overdueTasks.length > 0) {
        msg += `\n\n⚠️ *SCADUTI:*`;
        overdueTasks.forEach(t => {
            const days = daysOverdue(t.dueDate);
            msg += `\n  🔴 *${t.title}* - ${days}g di ritardo`;
        });
    }

    return msg;
}

/**
 * !mese - Task del mese (lista compatta)
 */
function formatMonthlyOverview(tasks, overdueTasks) {
    const monthName = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    let msg = `📋 *TASK DI ${monthName.toUpperCase()}*\n`;
    msg += '━━━━━━━━━━━━━━━━━━━━\n';

    if (tasks.length === 0 && overdueTasks.length === 0) {
        msg += '\n✅ Nessun task questo mese!';
        return msg;
    }

    tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    tasks.forEach(t => {
        const assignees = (t.assignedTo || []).join(', ');
        msg += `\n${formatTaskLine(t)}`;
        if (assignees) msg += `\n   👥 ${assignees}`;
    });

    if (overdueTasks.length > 0) {
        msg += `\n\n⚠️ *SCADUTI:*`;
        overdueTasks.forEach(t => {
            const days = daysOverdue(t.dueDate);
            msg += `\n  🔴 *${t.title}* - ${days}g di ritardo`;
        });
    }

    return msg;
}

/**
 * !task nome - Task di una persona specifica
 */
function formatPersonTasks(name, tasks, overdueTasks) {
    let msg = `👤 *TASK DI ${name.toUpperCase()}*\n`;
    msg += '━━━━━━━━━━━━━━━━━━━━\n';

    if (tasks.length === 0 && overdueTasks.length === 0) {
        msg += `\n✅ ${name} non ha task attivi!`;
        return msg;
    }

    if (tasks.length > 0) {
        tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        tasks.forEach(t => {
            const status = t.status === 'inprogress' ? '🔄' : '⬜';
            msg += `\n${status} ${formatTaskLine(t)}`;
        });
    }

    if (overdueTasks.length > 0) {
        msg += `\n\n⚠️ *SCADUTI:*`;
        overdueTasks.forEach(t => {
            const days = daysOverdue(t.dueDate);
            msg += `\n  🔴 *${t.title}* - ${days}g di ritardo`;
        });
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

    return `🆕 *NUOVO TASK*\n\n` +
        `${emoji} *${task.title}*\n` +
        `${task.description ? task.description + '\n' : ''}` +
        `👥 Assegnato a: *${assignees || 'Nessuno'}*` +
        owner + dueStr;
}

/**
 * Messaggio per task che scade domani
 */
function formatDeadlineWarning(task) {
    const assignees = (task.assignedTo || []).join(', ');
    return `⏰ *SCADE DOMANI*\n\n` +
        `*${task.title}*\n` +
        `👥 ${assignees || 'Nessuno'}`;
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
    return `🔄 *${task.title}*\n${statusLabels[oldStatus] || oldStatus} → ${statusLabels[newStatus] || newStatus}`;
}

/**
 * Messaggio per task completato
 */
function formatTaskCompleted(task) {
    return `✅ *TASK COMPLETATO!*\n*${task.title}*\n${task.owner ? `👑 ${task.owner}` : ''}`;
}

module.exports = {
    formatDailyReminder,
    formatWeeklyOverview,
    formatMonthlyOverview,
    formatPersonTasks,
    formatNewTaskAlert,
    formatDeadlineWarning,
    formatStatusChange,
    formatTaskCompleted,
    formatTaskLine,
    formatDate,
    formatDateShort,
    daysOverdue
};
