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
    const ctx       = eventName ? `\n🗂 _${eventName}_` : '';
    const lines     = [`${header}${ctx}`, `${emoji} *${task.title}*`];
    if (assignees)    lines.push(`👥 ${assignees}`);
    if (task.owner)   lines.push(`👑 _${task.owner}_`);
    if (task.dueDate) lines.push(`📅 ${formatDate(task.dueDate)}`);
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
    const ctx  = eventName ? `\n_${eventName}_` : '';
    const due  = task.dueDate ? `\n📅 ${formatDate(task.dueDate)}` : '';
    const verb = newAssignees.length === 1 ? 'aggiunto a' : 'aggiunti a';
    return `👥 *${newAssignees.join(', ')}* ${verb}:\n*${task.title}*${ctx}${due}`;
}

function formatDeadlineWarnings(tasks) {
    if (!tasks.length) return null;
    let msg = `⏰ *SCADE DOMANI*\n${SEP}\n\n`;
    msg += tasks.map(t => {
        const emoji     = PRIORITY_EMOJI[t.priority] || '⚪';
        const assignees = (t.assignedTo || []).join(', ');
        const ctx       = t._eventName ? `\n  _${t._eventName}_` : '';
        let line        = `${emoji} *${t.title}*${ctx}`;
        if (assignees)  line += `\n  👥 ${assignees}`;
        return line;
    }).join('\n\n');
    return msg.trim();
}

// ── RIEPILOGO GIORNALIERO ─────────────────────────────────────

function formatDailyReminder(tasksByMember, overdueByMember, todayDate, checklistItems, eventsToday) {
    const dateLabel = new Date(todayDate + 'T00:00:00').toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    let msg = `🗓 *RIEPILOGO DEL GIORNO*\n_${dateLabel}_\n${SEP}`;
    let hasContent = false;

    // Eventi oggi
    if (eventsToday && eventsToday.length > 0) {
        hasContent = true;
        msg += `\n\n📅 *EVENTI OGGI*\n\n`;
        msg += eventsToday.map(e => {
            let line = `  › *${e.title}*`;
            if (e.room) line += ` · _${e.room}_`;
            return line;
        }).join('\n');
    }

    // Task per membro
    const memberEntries = Object.entries(tasksByMember).filter(([, t]) => t.length > 0);
    if (memberEntries.length > 0) {
        hasContent = true;
        msg += `\n\n📋 *TASK IN SCADENZA OGGI*`;
        for (const [member, tasks] of memberEntries) {
            msg += `\n\n👤 *${member}*\n\n`;
            msg += tasks.map(t => {
                const emoji = PRIORITY_EMOJI[t.priority] || '⚪';
                let line    = `  ${emoji} ${t.title}`;
                if (t._eventName) line += `\n  _↳ ${t._eventName}_`;
                return line;
            }).join('\n\n');
        }
    }

    // Checklist
    if (checklistItems && checklistItems.length > 0) {
        hasContent = true;
        msg += `\n\n📌 *ATTIVITÀ CHECKLIST*\n\n`;
        msg += checklistItems.map(item => {
            let line = `  • *${item.text}*\n  _${item.taskTitle}`;
            if (item.assignee) line += ` · ${item.assignee}`;
            line += '_';
            return line;
        }).join('\n\n');
    }

    // Arretrati
    const overdueEntries = Object.entries(overdueByMember).filter(([, t]) => t.length > 0);
    if (overdueEntries.length > 0) {
        const total = overdueEntries.reduce((sum, [, t]) => sum + t.length, 0);
        hasContent = true;
        msg += `\n\n⚠️ *ARRETRATI* (${total})\n\n`;
        const overdueLines = [];
        for (const [member, tasks] of overdueEntries) {
            tasks.forEach(t => overdueLines.push(`  🔴 ${t.title} · _${member}_ · ${daysOverdue(t.dueDate)}gg`));
        }
        msg += overdueLines.join('\n');
    }

    msg += hasContent ? `\n\n${SEP}` : `\n\n✅ _Nessun task oggi. Buona giornata!_ 💪`;
    return msg.trim();
}

// ── SCADENZE SETTIMANA ────────────────────────────────────────

function formatWeeklyOverview(tasks, overdueTasks, checklistItems) {
    const now   = new Date();
    const end   = new Date(now); end.setDate(now.getDate() + 6);
    const range = `_${now.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} – ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}_`;

    let msg = `📅 *SCADENZE SETTIMANA*\n${range}\n${SEP}`;
    let hasContent = false;

    const boardTasks = tasks.filter(t => !t.calendarEventId);
    const eventTasks = tasks.filter(t =>  t.calendarEventId);

    if (boardTasks.length > 0) {
        hasContent = true;
        boardTasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        msg += `\n\n📋 *TASK DA BOARD*\n\n`;
        msg += boardTasks.map(t => {
            const assignees = (t.assignedTo || []).join(', ');
            let line = `  ${formatDayAbbr(t.dueDate)}  ${PRIORITY_EMOJI[t.priority] || '⚪'} *${t.title}*`;
            if (assignees) line += `\n  👥 _${assignees}_`;
            return line;
        }).join('\n\n');
    }

    if (eventTasks.length > 0) {
        hasContent = true;
        eventTasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        msg += `\n\n🗂 *ATTIVITÀ EVENTI*\n\n`;
        msg += eventTasks.map(t => {
            let line = `  ${formatDayAbbr(t.dueDate)}  ${PRIORITY_EMOJI[t.priority] || '⚪'} *${t.title}*`;
            if (t._eventName) line += `\n  ↳ _${t._eventName}_`;
            return line;
        }).join('\n\n');
    }

    if (checklistItems && checklistItems.length > 0) {
        hasContent = true;
        msg += `\n\n📌 *ATTIVITÀ CHECKLIST*\n\n`;
        msg += checklistItems.map(item => {
            let line = `  • *${item.text}* _(${formatDateShort(item.dueDate)})_\n  _${item.taskTitle}`;
            if (item.assignee) line += ` · ${item.assignee}`;
            line += '_';
            return line;
        }).join('\n\n');
    }

    if (overdueTasks.length > 0) {
        hasContent = true;
        msg += `\n\n⚠️ *ARRETRATI* (${overdueTasks.length})\n\n`;
        msg += overdueTasks.map(t => {
            const assignees = (t.assignedTo || []).join(', ');
            let line = `  🔴 *${t.title}* · ${daysOverdue(t.dueDate)}gg`;
            if (assignees) line += `\n  👥 _${assignees}_`;
            return line;
        }).join('\n\n');
    }

    msg += hasContent ? `\n\n${SEP}` : `\n\n✅ _Nessun task in scadenza questa settimana!_`;
    return msg.trim();
}

// ── TASK DEL MESE ─────────────────────────────────────────────

function formatMonthlyOverview(tasks, overdueTasks) {
    const monthName = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    let msg = `📋 *TASK DI ${monthName.toUpperCase()}*\n${SEP}`;

    if (tasks.length === 0 && overdueTasks.length === 0) {
        return msg + '\n\n✅ _Nessun task questo mese!_';
    }

    tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    msg += '\n\n';
    msg += tasks.map(t => {
        const assignees = (t.assignedTo || []).join(', ');
        let line = `  ${formatDayAbbr(t.dueDate)}  ${PRIORITY_EMOJI[t.priority] || '⚪'} *${t.title}*`;
        if (t._eventName) line += `\n  _↳ ${t._eventName}_`;
        if (assignees)    line += `\n  👥 ${assignees}`;
        return line;
    }).join('\n\n');

    if (overdueTasks.length > 0) {
        msg += `\n\n⚠️ *ARRETRATI* (${overdueTasks.length})\n\n`;
        msg += overdueTasks.map(t => {
            const assignees = (t.assignedTo || []).join(', ');
            let line = `  🔴 *${t.title}* · ${daysOverdue(t.dueDate)}gg`;
            if (assignees) line += ` _(${assignees})_`;
            return line;
        }).join('\n');
    }

    return msg.trim();
}

// ── TASK DI UNA PERSONA ───────────────────────────────────────

function formatPersonTasks(name, tasks, overdueTasks) {
    let msg = `👤 *TASK DI ${name.toUpperCase()}*\n${SEP}`;

    if (tasks.length === 0 && overdueTasks.length === 0) {
        return msg + `\n\n✅ _${name} non ha task attivi!_`;
    }

    if (tasks.length > 0) {
        tasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        msg += '\n\n';
        msg += tasks.map(t => {
            const date = t.dueDate ? formatDateShort(t.dueDate) : 'Nessuna scad.';
            let line   = `  ${STATUS_EMOJI[t.status] || '⬜'} ${PRIORITY_EMOJI[t.priority] || '⚪'} *${t.title}*\n  📅 ${date}`;
            if (t._eventName) line += `\n  _↳ ${t._eventName}_`;
            return line;
        }).join('\n\n');
    }

    if (overdueTasks.length > 0) {
        msg += `\n\n⚠️ *ARRETRATI*\n\n`;
        msg += overdueTasks.map(t => {
            const ctx = t._eventName ? ` _(${t._eventName})_` : '';
            return `  🔴 ${t.title}${ctx} · ${daysOverdue(t.dueDate)}gg di ritardo`;
        }).join('\n');
    }

    return msg.trim();
}

// ── ATTIVITÀ CHECKLIST ────────────────────────────────────────

function formatChecklistDeadlines(todayItems, weekItems) {
    let msg = `📌 *SCADENZE ATTIVITÀ*\n${SEP}`;

    if (todayItems.length === 0 && weekItems.length === 0) {
        return msg + '\n\n✅ _Nessuna attività con scadenza questa settimana!_';
    }

    if (todayItems.length > 0) {
        msg += `\n\n🔥 *OGGI*\n\n`;
        msg += todayItems.map(item => {
            let line = `  • *${item.text}*\n  _${item.taskTitle}`;
            if (item.assignee) line += ` · ${item.assignee}`;
            line += '_';
            return line;
        }).join('\n\n');
    }

    const futureItems = weekItems.filter(w =>
        !todayItems.some(t => t.text === w.text && t.taskTitle === w.taskTitle)
    );
    if (futureItems.length > 0) {
        msg += `\n\n📅 *PROSSIMI GIORNI*\n\n`;
        msg += futureItems.map(item => {
            let line = `  • *${item.text}* _(${formatDateShort(item.dueDate)})_\n  _${item.taskTitle}`;
            if (item.assignee) line += ` · ${item.assignee}`;
            line += '_';
            return line;
        }).join('\n\n');
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
    let msg = `📋 *TASK ATTIVI*\n${SEP}`;
    let counter = 1;

    if (boardTasks.length > 0) {
        msg += `\n\n*DA BOARD* (${boardTasks.length})\n\n`;
        msg += boardTasks.map(t => {
            const assignees = (t.assignedTo || []).join(', ');
            let line = `  ${STATUS_EMOJI[t.status] || '⬜'} *${counter++}.* ${t.title}`;
            if (assignees) line += `\n  👥 _${assignees}_`;
            return line;
        }).join('\n\n');
    }

    if (eventTasks.length > 0) {
        msg += `\n\n*DA EVENTI* (${eventTasks.length})\n\n`;
        msg += eventTasks.map(t => {
            let line = `  ${STATUS_EMOJI[t.status] || '⬜'} *${counter++}.* ${t.title}`;
            if (t._eventName) line += `\n  ← _${t._eventName}_`;
            return line;
        }).join('\n\n');
    }

    msg += `\n\n_!fatto nome · !inizia nome_`;
    return msg.trim();
}

// ── REPORT SETTIMANALE ────────────────────────────────────────

function formatWeeklyReport(completedTasks, overdueTasks, weekAheadTasks) {
    const dateLabel = new Date().toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    let msg = `📊 *REPORT SETTIMANALE*\n_${dateLabel}_\n${SEP}`;

    if (completedTasks.length > 0) {
        msg += `\n\n✅ *COMPLETATI* (${completedTasks.length})\n\n`;
        msg += completedTasks.map(t => {
            const assignees = (t.assignedTo || []).join(', ');
            let line = `  › *${t.title}*`;
            if (assignees) line += `\n  👥 _${assignees}_`;
            return line;
        }).join('\n\n');
    } else {
        msg += `\n\n⚠️ _Nessun task completato la settimana scorsa_`;
    }

    if (overdueTasks.length > 0) {
        msg += `\n\n🔴 *ARRETRATI* (${overdueTasks.length})\n\n`;
        msg += overdueTasks.map(t => {
            const assignees = (t.assignedTo || []).join(', ');
            let line = `  › *${t.title}* · ${daysOverdue(t.dueDate)}gg`;
            if (assignees) line += `\n  👥 _${assignees}_`;
            return line;
        }).join('\n\n');
    }

    if (weekAheadTasks.length > 0) {
        msg += `\n\n📅 *QUESTA SETTIMANA* (${weekAheadTasks.length})\n\n`;
        weekAheadTasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        msg += weekAheadTasks.map(t => {
            const assignees = (t.assignedTo || []).join(', ');
            let line = `  ${formatDayAbbr(t.dueDate)}  ${PRIORITY_EMOJI[t.priority] || '⚪'} *${t.title}*`;
            if (assignees) line += `\n  👥 _${assignees}_`;
            return line;
        }).join('\n\n');
    } else {
        msg += `\n\n📅 _Nessun task in programma questa settimana_`;
    }

    msg += `\n\n${SEP}`;
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

    let msg = `🎙️ *PROSSIMI EVENTI*\n${SEP}\n\n`;

    msg += future.slice(0, 10).map(e => {
        const dateStr   = e.start.split('T')[0];
        const d         = new Date(dateStr + 'T00:00:00');
        const dayDiff   = Math.ceil((d - new Date(todayStr + 'T00:00:00')) / (1000 * 60 * 60 * 24));
        const countdown = dayDiff === 0 ? '*OGGI*' : dayDiff === 1 ? '*domani*' : `_tra ${dayDiff}gg_`;
        const dayStr    = `${DAY_SHORT[d.getDay()]} ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
        const room      = e.room ? ` · _${e.room}_` : '';
        return `  📅 *${e.title}*\n  ${dayStr} ${countdown}${room}`;
    }).join('\n\n');

    if (future.length > 10) msg += `\n\n_...e altri ${future.length - 10} eventi_`;

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
