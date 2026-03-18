// message-formatter.js

const SEP = '━━━━━━━━━━━━━━━━';
const PRIORITY_EMOJI = { high: '🔴', medium: '🟠', low: '🔵' };
const STATUS_EMOJI   = { todo: '⬜', inprogress: '🔄', done: '✅' };
const DAY_SHORT      = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

// ── UTILITY ──────────────────────────────────────────────────

function formatDate(dateStr) {
    if (!dateStr) return 'Nessuna scadenza';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

function formatDateShort(dateStr) {
    if (!dateStr) return 'N/D';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
        weekday: 'short', day: 'numeric', month: 'short'
    });
}

function formatDayAbbr(dateStr) {
    if (!dateStr) return '   ';
    return DAY_SHORT[new Date(dateStr + 'T00:00:00').getDay()];
}

function daysOverdue(dueDate) {
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.floor((today - new Date(dueDate + 'T00:00:00')) / (1000 * 60 * 60 * 24));
}

// ── NOTIFICHE REAL-TIME ───────────────────────────────────────

function formatNewTaskAlert(task, eventName) {
    const emoji     = PRIORITY_EMOJI[task.priority] || '⚪';
    const assignees = (task.assignedTo || []).join(', ');
    const header    = eventName ? '🆕 *NUOVA ATTIVITÀ EVENTO*' : '🆕 *NUOVO TASK*';
    const ctx       = eventName ? `🗂 _${eventName}_\n` : '';
    const lines     = [`${header}`, `${ctx}${emoji} *${task.title}*`];
    if (assignees)      lines.push(`👥 ${assignees}`);
    if (task.owner)     lines.push(`👑 _${task.owner}_`);
    if (task.dueDate)   lines.push(`📅 ${formatDate(task.dueDate)}`);
    return lines.join('\n');
}

function formatTaskCompleted(task, eventName) {
    const ctx   = eventName ? `\n_${eventName}_` : '';
    const owner = task.owner ? `\n👑 ${task.owner}` : '';
    return `✅ *COMPLETATO*\n*${task.title}*${ctx}${owner}`;
}

function formatStatusChange(task, oldStatus, newStatus, eventName) {
    const labels    = { todo: 'Da fare', inprogress: 'In corso 🔄', done: 'Completato ✅' };
    const ctx       = eventName ? `\n_${eventName}_` : '';
    const assignees = (task.assignedTo || []);
    const who       = assignees.length ? `\n👥 ${assignees.join(', ')}` : '';
    return `🔄 *${task.title}*${ctx}\n${labels[oldStatus] || oldStatus} → *${labels[newStatus] || newStatus}*${who}`;
}

function formatNewAssignment(task, newAssignees, eventName) {
    const ctx = eventName ? `\n_${eventName}_` : '';
    const due = task.dueDate ? `\n📅 ${formatDate(task.dueDate)}` : '';
    const verb = newAssignees.length === 1 ? 'aggiunto a' : 'aggiunti a';
    return `👥 *${newAssignees.join(', ')}* ${verb}:\n*${task.title}*${ctx}${due}`;
}

function formatDeadlineWarnings(tasks) {
    if (!tasks.length) return null;
    let msg = `⏰ *SCADE DOMANI*\n${SEP}\n`;
    tasks.forEach(t => {
        const emoji     = PRIORITY_EMOJI[t.priority] || '⚪';
        const assignees = (t.assignedTo || []).join(', ');
        const ctx       = t._eventName ? ` _(${t._eventName})_` : '';
        msg += `  ${emoji} *${t.title}*${ctx}`;
        if (assignees) msg += ` · ${assignees}`;
        msg += '\n';
    });
    return msg.trim();
}

// ── RIEPILOGO GIORNALIERO ─────────────────────────────────────

function formatDailyReminder(tasksByMember, overdueByMember, todayDate, checklistItems, eventsToday) {
    const dateLabel = new Date(todayDate + 'T00:00:00').toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    let msg = `🗓 *RIEPILOGO DEL GIORNO*\n_${dateLabel}_\n${SEP}\n`;
    let hasContent = false;

    if (eventsToday && eventsToday.length > 0) {
        hasContent = true;
        msg += `\n📅 *EVENTI OGGI*\n`;
        eventsToday.forEach(e => {
            msg += `  › *${e.title}*`;
            if (e.room) msg += ` · _${e.room}_`;
            msg += '\n';
        });
    }

    const memberEntries = Object.entries(tasksByMember).filter(([, t]) => t.length > 0);
    if (memberEntries.length > 0) {
        hasContent = true;
        msg += `\n📋 *TASK IN SCADENZA OGGI*\n`;
        for (const [member, tasks] of memberEntries) {
            msg += `\n👤 *${member}*\n`;
            tasks.forEach(t => {
                const emoji = PRIORITY_EMOJI[t.priority] || '⚪';
                msg += `  ${emoji} ${t.title}\n`;
                if (t._eventName) msg += `    _↳ ${t._eventName}_\n`;
            });
        }
    }

    if (checklistItems && checklistItems.length > 0) {
        hasContent = true;
        msg += `\n📌 *ATTIVITÀ CHECKLIST*\n`;
        checklistItems.forEach(item => {
            msg += `  • *${item.text}*\n    _${item.taskTitle}`;
            if (item.assignee) msg += ` · ${item.assignee}`;
            msg += '_\n';
        });
    }

    const overdueEntries = Object.entries(overdueByMember).filter(([, t]) => t.length > 0);
    if (overdueEntries.length > 0) {
        const total = overdueEntries.reduce((sum, [, t]) => sum + t.length, 0);
        hasContent = true;
        msg += `\n⚠️ *ARRETRATI* (${total})\n`;
        for (const [member, tasks] of overdueEntries) {
            tasks.forEach(t => {
                msg += `  🔴 ${t.title} · _${member}_ · ${daysOverdue(t.dueDate)}gg\n`;
            });
        }
    }

    if (!hasContent) {
        msg += '\n✅ _Nessun task oggi. Buona giornata!_ 💪';
    } else {
        msg += `\n${SEP}`;
    }

    return msg.trim();
}

// ── SCADENZE SETTIMANA ────────────────────────────────────────

function formatWeeklyOverview(tasks, overdueTasks, checklistItems) {
    const now   = new Date();
    const end   = new Date(now); end.setDate(now.getDate() + 6);
    const range = `_${now.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} – ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}_`;

    let msg = `📅 *SCADENZE SETTIMANA*\n${range}\n${SEP}\n`;
    let hasContent = false;

    const boardTasks = tasks.filter(t => !t.calendarEventId);
    const eventTasks = tasks.filter(t =>  t.calendarEventId);

    if (boardTasks.length > 0) {
        hasContent = true;
        boardTasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        msg += `\n📋 *TASK DA BOARD*\n`;
        boardTasks.forEach(t => {
            const assignees = (t.assignedTo || []).join(', ');
            msg += `  ${formatDayAbbr(t.dueDate)}  ${PRIORITY_EMOJI[t.priority] || '⚪'} ${t.title}`;
            if (assignees) msg += ` _(${assignees})_`;
            msg += '\n';
        });
    }

    if (eventTasks.length > 0) {
        hasContent = true;
        eventTasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        msg += `\n🗂 *ATTIVITÀ EVENTI*\n`;
        eventTasks.forEach(t => {
            msg += `  ${formatDayAbbr(t.dueDate)}  ${PRIORITY_EMOJI[t.priority] || '⚪'} ${t.title}`;
            if (t._eventName) msg += ` ↳ _${t._eventName}_`;
            msg += '\n';
        });
    }

    if (checklistItems && checklistItems.length > 0) {
        hasContent = true;
        msg += `\n📌 *ATTIVITÀ CHECKLIST*\n`;
        checklistItems.forEach(item => {
            msg += `  • *${item.text}* _(${formatDateShort(item.dueDate)})_\n    _${item.taskTitle}`;
            if (item.assignee) msg += ` · ${item.assignee}`;
            msg += '_\n';
        });
    }

    if (overdueTasks.length > 0) {
        hasContent = true;
        msg += `\n⚠️ *ARRETRATI* (${overdueTasks.length})\n`;
        overdueTasks.forEach(t => {
            const assignees = (t.assignedTo || []).join(', ');
            msg += `  🔴 ${t.title} · ${daysOverdue(t.dueDate)}gg`;
            if (assignees) msg += ` _(${assignees})_`;
            msg += '\n';
        });
    }

    if (!hasContent) msg += '\n✅ _Nessun task in scadenza questa settimana!_';
    else msg += `\n${SEP}`;

    return msg.trim();
}

// ── TASK DEL MESE ─────────────────────────────────────────────

function formatMonthlyOverview(tasks, overdueTasks) {
    const monthName = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    let msg = `📋 *TASK DI ${monthName.toUpperCase()}*\n${SEP}\n`;

    if (tasks.length === 0 && overdueTasks.length === 0) {
        return msg + '\n✅ _Nessun task questo mese!_';
    }

    tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    tasks.forEach(t => {
        const assignees = (t.assignedTo || []).join(', ');
        msg += `\n  ${formatDayAbbr(t.dueDate)}  ${PRIORITY_EMOJI[t.priority] || '⚪'} *${t.title}*`;
        if (t._eventName) msg += `\n    _↳ ${t._eventName}_`;
        if (assignees) msg += `\n    👥 ${assignees}`;
        msg += '\n';
    });

    if (overdueTasks.length > 0) {
        msg += `\n⚠️ *ARRETRATI* (${overdueTasks.length})\n`;
        overdueTasks.forEach(t => {
            const assignees = (t.assignedTo || []).join(', ');
            msg += `  🔴 ${t.title} · ${daysOverdue(t.dueDate)}gg`;
            if (assignees) msg += ` _(${assignees})_`;
            msg += '\n';
        });
    }

    return msg.trim();
}

// ── TASK DI UNA PERSONA ───────────────────────────────────────

function formatPersonTasks(name, tasks, overdueTasks) {
    let msg = `👤 *TASK DI ${name.toUpperCase()}*\n${SEP}\n`;

    if (tasks.length === 0 && overdueTasks.length === 0) {
        return msg + `\n✅ _${name} non ha task attivi!_`;
    }

    if (tasks.length > 0) {
        tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        tasks.forEach(t => {
            const date = t.dueDate ? formatDateShort(t.dueDate) : 'Nessuna scad.';
            msg += `\n  ${STATUS_EMOJI[t.status] || '⬜'} ${PRIORITY_EMOJI[t.priority] || '⚪'} *${t.title}*\n    📅 ${date}`;
            if (t._eventName) msg += `\n    _↳ ${t._eventName}_`;
            msg += '\n';
        });
    }

    if (overdueTasks.length > 0) {
        msg += `\n⚠️ *ARRETRATI*\n`;
        overdueTasks.forEach(t => {
            const ctx = t._eventName ? ` _(${t._eventName})_` : '';
            msg += `  🔴 ${t.title}${ctx} · ${daysOverdue(t.dueDate)}gg di ritardo\n`;
        });
    }

    return msg.trim();
}

// ── ATTIVITÀ CHECKLIST ────────────────────────────────────────

function formatChecklistDeadlines(todayItems, weekItems) {
    let msg = `📌 *SCADENZE ATTIVITÀ*\n${SEP}\n`;

    if (todayItems.length === 0 && weekItems.length === 0) {
        return msg + '\n✅ _Nessuna attività con scadenza questa settimana!_';
    }

    if (todayItems.length > 0) {
        msg += `\n🔥 *OGGI*\n`;
        todayItems.forEach(item => {
            msg += `  • *${item.text}*\n    _${item.taskTitle}`;
            if (item.assignee) msg += ` · ${item.assignee}`;
            msg += '_\n';
        });
    }

    const futureItems = weekItems.filter(w =>
        !todayItems.some(t => t.text === w.text && t.taskTitle === w.taskTitle)
    );
    if (futureItems.length > 0) {
        msg += `\n📅 *PROSSIMI GIORNI*\n`;
        futureItems.forEach(item => {
            msg += `  • *${item.text}* _(${formatDateShort(item.dueDate)})_\n    _${item.taskTitle}`;
            if (item.assignee) msg += ` · ${item.assignee}`;
            msg += '_\n';
        });
    }

    return msg.trim();
}

// ── LISTA TASK ────────────────────────────────────────────────

function formatTaskList(tasks) {
    if (tasks.length === 0) {
        return `📋 *TASK ATTIVI*\n${SEP}\n\n✅ _Nessun task attivo!_`;
    }

    const boardTasks = tasks.filter(t => !t.calendarEventId);
    const eventTasks = tasks.filter(t =>  t.calendarEventId);
    let msg = `📋 *TASK ATTIVI*\n${SEP}\n`;
    let counter = 1;

    if (boardTasks.length > 0) {
        msg += `\n*DA BOARD* (${boardTasks.length})\n`;
        boardTasks.forEach(t => {
            const assignees = (t.assignedTo || []).join(', ');
            msg += `  ${STATUS_EMOJI[t.status] || '⬜'} *${counter++}.* ${t.title}`;
            if (assignees) msg += ` _(${assignees})_`;
            msg += '\n';
        });
    }

    if (eventTasks.length > 0) {
        msg += `\n*DA EVENTI* (${eventTasks.length})\n`;
        eventTasks.forEach(t => {
            const ctx = t._eventName ? ` ← _${t._eventName}_` : '';
            msg += `  ${STATUS_EMOJI[t.status] || '⬜'} *${counter++}.* ${t.title}${ctx}\n`;
        });
    }

    msg += `\n_!fatto nome · !inizia nome_`;
    return msg.trim();
}

// ── REPORT SETTIMANALE ────────────────────────────────────────

function formatWeeklyReport(completedTasks, overdueTasks, weekAheadTasks) {
    const dateLabel = new Date().toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    let msg = `📊 *REPORT SETTIMANALE*\n_${dateLabel}_\n${SEP}\n`;

    if (completedTasks.length > 0) {
        msg += `\n✅ *COMPLETATI* (${completedTasks.length})\n`;
        completedTasks.forEach(t => {
            const assignees = (t.assignedTo || []).join(', ');
            msg += `  › ${t.title}`;
            if (assignees) msg += ` _(${assignees})_`;
            msg += '\n';
        });
    } else {
        msg += `\n⚠️ _Nessun task completato la settimana scorsa_\n`;
    }

    if (overdueTasks.length > 0) {
        msg += `\n🔴 *ARRETRATI* (${overdueTasks.length})\n`;
        overdueTasks.forEach(t => {
            const assignees = (t.assignedTo || []).join(', ');
            msg += `  › ${t.title} · ${daysOverdue(t.dueDate)}gg`;
            if (assignees) msg += ` _(${assignees})_`;
            msg += '\n';
        });
    }

    if (weekAheadTasks.length > 0) {
        msg += `\n📅 *QUESTA SETTIMANA* (${weekAheadTasks.length})\n`;
        weekAheadTasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        weekAheadTasks.forEach(t => {
            const assignees = (t.assignedTo || []).join(', ');
            msg += `  ${formatDayAbbr(t.dueDate)}  ${PRIORITY_EMOJI[t.priority] || '⚪'} ${t.title}`;
            if (assignees) msg += ` _(${assignees})_`;
            msg += '\n';
        });
    } else {
        msg += `\n📅 _Nessun task in programma questa settimana_\n`;
    }

    msg += `\n${SEP}`;
    return msg.trim();
}

// ── LISTA EVENTI ──────────────────────────────────────────────

function formatEventsList(events) {
    const todayStr = new Date().toISOString().split('T')[0];

    const future = events
        .filter(e => e.start && e.start.split('T')[0] >= todayStr)
        .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

    if (future.length === 0) {
        return `🎙️ *PROSSIMI EVENTI*\n${SEP}\n\n_Nessun evento in programma._`;
    }

    let msg = `🎙️ *PROSSIMI EVENTI*\n${SEP}\n`;

    future.slice(0, 10).forEach(e => {
        const dateStr  = e.start.split('T')[0];
        const d        = new Date(dateStr + 'T00:00:00');
        const dayDiff  = Math.ceil((d - new Date(todayStr + 'T00:00:00')) / (1000 * 60 * 60 * 24));
        const countdown = dayDiff === 0 ? '*OGGI*' : dayDiff === 1 ? '*domani*' : `_tra ${dayDiff}gg_`;
        const dayStr   = `${DAY_SHORT[d.getDay()]} ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
        const room     = e.room ? ` · _${e.room}_` : '';
        msg += `\n  📅 *${e.title}*\n  ${dayStr} ${countdown}${room}\n`;
    });

    if (future.length > 10) msg += `\n_...e altri ${future.length - 10} eventi_\n`;

    return msg.trim();
}

module.exports = {
    formatDailyReminder,
    formatWeeklyOverview,
    formatMonthlyOverview,
    formatPersonTasks,
    formatChecklistDeadlines,
    formatTaskList,
    formatNewTaskAlert,
    formatDeadlineWarnings,
    formatStatusChange,
    formatTaskCompleted,
    formatNewAssignment,
    formatWeeklyReport,
    formatEventsList,
    formatDate,
    formatDateShort,
    daysOverdue
};
