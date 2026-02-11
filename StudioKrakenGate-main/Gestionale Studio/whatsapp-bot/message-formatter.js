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
    return `${emoji} *${task.title}*\n    Scadenza: ${date}`;
}

// ---------------------------------------------------
// COMANDI
// ---------------------------------------------------

/**
 * !oggi - Task in scadenza oggi + attivita checklist
 */
function formatDailyReminder(tasksByMember, overdueByMember, todayDate, checklistItems) {
    let msg = `📋 *TASK DI OGGI*\n${formatDate(todayDate)}\n\n`;

    let hasContent = false;

    for (const [member, tasks] of Object.entries(tasksByMember)) {
        if (tasks.length === 0) continue;
        hasContent = true;
        msg += `👤 *${member}* (${tasks.length} task):\n\n`;
        tasks.forEach(t => {
            msg += `${formatTaskLine(t)}\n\n`;
        });
    }

    if (checklistItems && checklistItems.length > 0) {
        hasContent = true;
        msg += `📌 *ATTIVITA DA FARE OGGI:*\n\n`;
        checklistItems.forEach(item => {
            msg += `- *${item.text}*\n    Task: ${item.taskTitle}`;
            if (item.assignee) msg += `\n    Chi: ${item.assignee}`;
            msg += '\n\n';
        });
    }

    const overdueList = Object.entries(overdueByMember).filter(([, t]) => t.length > 0);
    if (overdueList.length > 0) {
        hasContent = true;
        msg += `⚠️ *ARRETRATI*\n\n`;
        for (const [member, tasks] of overdueList) {
            tasks.forEach(t => {
                const days = daysOverdue(t.dueDate);
                msg += `🔴 *${t.title}*\n    ${member} - ${days} giorni di ritardo\n\n`;
            });
        }
    }

    if (!hasContent) {
        msg += '✅ Nessun task oggi e nessun arretrato!\n\nBuona giornata! 💪';
    }

    return msg.trim();
}

/**
 * !settimana - Task in scadenza questa settimana + attivita checklist
 */
function formatWeeklyOverview(tasks, overdueTasks, checklistItems) {
    let msg = `📋 *SCADENZE SETTIMANA*\n\n`;

    let hasContent = false;

    if (tasks.length > 0) {
        hasContent = true;
        tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        tasks.forEach(t => {
            const assignees = (t.assignedTo || []).join(', ');
            msg += `${formatTaskLine(t)}`;
            if (assignees) msg += `\n    Assegnato a: ${assignees}`;
            msg += '\n\n';
        });
    }

    if (checklistItems && checklistItems.length > 0) {
        hasContent = true;
        msg += `📌 *ATTIVITA CHECKLIST:*\n\n`;
        checklistItems.forEach(item => {
            msg += `- *${item.text}* (${formatDateShort(item.dueDate)})\n    Task: ${item.taskTitle}`;
            if (item.assignee) msg += `\n    Chi: ${item.assignee}`;
            msg += '\n\n';
        });
    }

    if (overdueTasks.length > 0) {
        hasContent = true;
        msg += `⚠️ *ARRETRATI*\n\n`;
        overdueTasks.forEach(t => {
            const days = daysOverdue(t.dueDate);
            msg += `🔴 *${t.title}* - ${days} giorni di ritardo\n\n`;
        });
    }

    if (!hasContent) {
        msg += '✅ Nessun task in scadenza questa settimana!';
    }

    return msg.trim();
}

/**
 * !mese - Task del mese
 */
function formatMonthlyOverview(tasks, overdueTasks) {
    const monthName = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    let msg = `📋 *TASK DI ${monthName.toUpperCase()}*\n\n`;

    if (tasks.length === 0 && overdueTasks.length === 0) {
        msg += '✅ Nessun task questo mese!';
        return msg;
    }

    tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    tasks.forEach(t => {
        const assignees = (t.assignedTo || []).join(', ');
        msg += `${formatTaskLine(t)}`;
        if (assignees) msg += `\n    Assegnato a: ${assignees}`;
        msg += '\n\n';
    });

    if (overdueTasks.length > 0) {
        msg += `⚠️ *ARRETRATI*\n\n`;
        overdueTasks.forEach(t => {
            const days = daysOverdue(t.dueDate);
            msg += `🔴 *${t.title}* - ${days} giorni di ritardo\n\n`;
        });
    }

    return msg.trim();
}

/**
 * !task nome - Task di una persona specifica
 */
function formatPersonTasks(name, tasks, overdueTasks) {
    let msg = `👤 *TASK DI ${name.toUpperCase()}*\n\n`;

    if (tasks.length === 0 && overdueTasks.length === 0) {
        msg += `✅ ${name} non ha task attivi!`;
        return msg;
    }

    if (tasks.length > 0) {
        tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        tasks.forEach(t => {
            const status = t.status === 'inprogress' ? '🔄' : '⬜';
            const emoji = PRIORITY_EMOJI[t.priority] || '⚪';
            const date = formatDateShort(t.dueDate);
            msg += `${status} ${emoji} *${t.title}*\n    Scadenza: ${date}\n\n`;
        });
    }

    if (overdueTasks.length > 0) {
        msg += `⚠️ *ARRETRATI*\n\n`;
        overdueTasks.forEach(t => {
            const days = daysOverdue(t.dueDate);
            msg += `🔴 *${t.title}* - ${days} giorni di ritardo\n\n`;
        });
    }

    return msg.trim();
}

/**
 * !scadenze - Attivita checklist in scadenza oggi/settimana
 */
function formatChecklistDeadlines(todayItems, weekItems) {
    let msg = `📌 *SCADENZE ATTIVITA*\n\n`;

    if (todayItems.length === 0 && weekItems.length === 0) {
        msg += '✅ Nessuna attivita con scadenza questa settimana!';
        return msg;
    }

    if (todayItems.length > 0) {
        msg += `🔥 *OGGI:*\n\n`;
        todayItems.forEach(item => {
            msg += `- *${item.text}*\n`;
            msg += `    Task: ${item.taskTitle}`;
            if (item.assignee) msg += `\n    Chi: ${item.assignee}`;
            msg += '\n\n';
        });
    }

    const futureItems = weekItems.filter(w =>
        !todayItems.some(t => t.text === w.text && t.taskTitle === w.taskTitle)
    );

    if (futureItems.length > 0) {
        msg += `📅 *PROSSIMI GIORNI:*\n\n`;
        futureItems.forEach(item => {
            msg += `- *${item.text}* (${formatDateShort(item.dueDate)})\n`;
            msg += `    Task: ${item.taskTitle}`;
            if (item.assignee) msg += `\n    Chi: ${item.assignee}`;
            msg += '\n\n';
        });
    }

    return msg.trim();
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
        todo: 'Da Fare',
        inprogress: 'In Corso 🔄',
        done: 'Completato ✅'
    };
    return `🔄 *${task.title}*\n${statusLabels[oldStatus] || oldStatus} -> ${statusLabels[newStatus] || newStatus}`;
}

/**
 * Messaggio per task completato
 */
function formatTaskCompleted(task) {
    return `✅ *TASK COMPLETATO!*\n\n*${task.title}*\n${task.owner ? `👑 ${task.owner}` : ''}\n\nOttimo lavoro! 🎉`;
}

module.exports = {
    formatDailyReminder,
    formatWeeklyOverview,
    formatMonthlyOverview,
    formatPersonTasks,
    formatChecklistDeadlines,
    formatNewTaskAlert,
    formatDeadlineWarning,
    formatStatusChange,
    formatTaskCompleted,
    formatTaskLine,
    formatDate,
    formatDateShort,
    daysOverdue
};
