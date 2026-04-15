import { database } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';

let allTasks = [];
let allEvents = [];
let allIncome = [];
let allVarExpenses = [];
let allFixedExpenses = [];
let allStreams = [];
let allTargets = [];
let cassaBalance = 0;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtMoney = (n) => {
    const num = Number(n) || 0;
    return '€ ' + num.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const fmtCompact = (n) => {
    const num = Number(n) || 0;
    if (num >= 1000000) return '€ ' + (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return '€ ' + (num / 1000).toFixed(1) + 'K';
    return '€ ' + num.toLocaleString('it-IT', { maximumFractionDigits: 0 });
};

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

const toArray = (snapshotVal) => {
    if (!snapshotVal) return [];
    if (Array.isArray(snapshotVal)) return snapshotVal.filter(Boolean);
    return Object.values(snapshotVal);
};

function renderHeader() {
    const dateEl = document.getElementById('home-date');
    const nameEl = document.getElementById('home-user-name');
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (nameEl) {
        nameEl.textContent = (currentUser?.name || 'amico').split(' ')[0];
    }
}

function renderTodayWidget() {
    const listEl = document.getElementById('today-list');
    const countEl = document.getElementById('today-count');
    if (!listEl || !countEl) return;

    const userName = currentUser?.name;
    const today = startOfDay(new Date());
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    const in7End = endOfDay(in7);

    const parseDate = (s) => {
        if (!s) return null;
        const d = s.length <= 10 ? new Date(s + 'T00:00:00') : new Date(s);
        return isNaN(d) ? null : d;
    };

    const inWindow = (d) => d && d >= today && d <= in7End;

    const dayLabel = (d) => {
        const diff = Math.round((startOfDay(d) - today) / 86400000);
        if (diff <= 0) return 'Oggi';
        if (diff === 1) return 'Domani';
        return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    // Task miei aperti con scadenza entro 7 giorni
    const myTasks = allTasks
        .filter(t => {
            if (!t || t.status === 'done' || t.archived) return false;
            const d = parseDate(t.dueDate);
            if (!inWindow(d)) return false;
            const isOwner = t.owner === userName;
            const isAssigned = Array.isArray(t.assignedTo) && t.assignedTo.includes(userName);
            return isOwner || isAssigned;
        })
        .map(t => ({
            icon: 'fa-clipboard-check',
            label: t.title,
            sub: dayLabel(parseDate(t.dueDate)),
            date: parseDate(t.dueDate)
        }));

    // Sotto-attività aperte mie (o "tutti") con scadenza entro 7 giorni
    const mySubtasks = [];
    allTasks.forEach(t => {
        if (!t || !Array.isArray(t.checklist) || t.archived) return;
        t.checklist.forEach(item => {
            if (!item || item.done) return;
            const mine = item.assignee === userName || item.assignee === 'tutti';
            if (!mine) return;
            const d = parseDate(item.dueDate || t.dueDate);
            if (!inWindow(d)) return;
            mySubtasks.push({
                icon: 'fa-check-square',
                label: item.text,
                sub: `${t.title} · ${dayLabel(d)}`,
                date: d
            });
        });
    });

    // Eventi calendario entro 7 giorni dove sono partecipante
    const myEvents = allEvents
        .filter(e => {
            if (!e || !e.start) return false;
            const d = parseDate(e.start);
            if (!inWindow(d)) return false;
            return Array.isArray(e.participants) && e.participants.includes(userName);
        })
        .map(e => {
            const d = parseDate(e.start);
            const hh = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            return { icon: 'fa-calendar-day', label: e.title, sub: `${dayLabel(d)} · ${hh}`, date: d };
        });

    const items = [...myTasks, ...mySubtasks, ...myEvents].sort((a, b) => a.date - b.date);

    countEl.textContent = items.length;

    if (items.length === 0) {
        listEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-6 text-white/80">
                <i class="fa-solid fa-mug-hot text-3xl mb-2"></i>
                <p class="text-sm font-medium">Niente in agenda</p>
                <p class="text-xs">Goditela ✨</p>
            </div>`;
        return;
    }

    listEl.innerHTML = items.slice(0, 5).map(it => `
        <div class="mini-row rounded-lg px-3 py-2 flex items-center gap-3">
            <i class="fa-solid ${it.icon} text-white/80 w-5 text-center"></i>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold truncate">${esc(it.label)}</p>
                ${it.sub ? `<p class="text-xs text-white/80 truncate">${esc(it.sub)}</p>` : ''}
            </div>
        </div>
    `).join('') + (items.length > 5 ? `<p class="text-xs text-white/80 text-center pt-1">+ altri ${items.length - 5}</p>` : '');
}

function renderWeekWidget() {
    const listEl = document.getElementById('week-list');
    const countEl = document.getElementById('week-count');
    if (!listEl || !countEl) return;

    const today = startOfDay(new Date());
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);

    // Eventi entro 7 giorni (futuri, includendo oggi)
    const events = allEvents
        .filter(e => {
            if (!e || !e.start) return false;
            const d = new Date(e.start);
            return !isNaN(d) && d >= today && d <= endOfDay(in7);
        })
        .map(e => ({ type: 'event', date: new Date(e.start), title: e.title }));

    // Task non completati con dueDate entro 7 giorni
    const tasks = allTasks
        .filter(t => {
            if (!t || t.status === 'done' || t.archived || !t.dueDate) return false;
            const d = new Date(t.dueDate + 'T00:00:00');
            return !isNaN(d) && d >= today && d <= endOfDay(in7);
        })
        .map(t => ({ type: 'task', date: new Date(t.dueDate + 'T00:00:00'), title: t.title, priority: t.priority }));

    // Live Gate Radio future entro 7 giorni
    const lives = allStreams
        .filter(s => {
            if (!s || !s.date) return false;
            const d = new Date(s.date + 'T00:00:00');
            return !isNaN(d) && d >= today && d <= endOfDay(in7);
        })
        .map(s => ({ type: 'live', date: new Date(s.date + 'T00:00:00'), title: s.artist ? `Live: ${s.artist}` : 'Live Gate Radio' }));

    const all = [...events, ...tasks, ...lives].sort((a, b) => a.date - b.date);

    countEl.textContent = all.length;

    if (all.length === 0) {
        listEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-6 text-white/80">
                <i class="fa-solid fa-bed text-3xl mb-2"></i>
                <p class="text-sm font-medium">Nessun evento in settimana</p>
            </div>`;
        return;
    }

    const iconFor = (t) => t === 'event' ? 'fa-calendar' : t === 'task' ? 'fa-clipboard-list' : 'fa-microphone-lines';
    const dayLabel = (d) => {
        const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
        if (diff === 0) return 'Oggi';
        if (diff === 1) return 'Domani';
        return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    listEl.innerHTML = all.slice(0, 4).map(it => `
        <div class="mini-row rounded-lg px-3 py-2 flex items-center gap-3">
            <i class="fa-solid ${iconFor(it.type)} text-white/80 w-5 text-center"></i>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold truncate">${esc(it.title)}</p>
                <p class="text-xs text-white/80 truncate">${dayLabel(it.date)}</p>
            </div>
        </div>
    `).join('') + (all.length > 4 ? `<p class="text-xs text-white/80 text-center pt-1">+ altri ${all.length - 4}</p>` : '');
}

function renderFinanzeWidget() {
    const card = document.getElementById('finanze-card');
    if (!card) return;

    if (currentUser?.role === 'user_base') {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');

    const balanceEl = document.getElementById('cassa-balance');
    const incomeEl = document.getElementById('income-month');
    const expenseEl = document.getElementById('expense-month');
    const labelEl = document.getElementById('finanze-month-label');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const inMonth = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return !isNaN(d) && d >= monthStart && d <= monthEnd;
    };

    const monthIncome = allIncome
        .filter(e => e && inMonth(e.date))
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

    const monthVar = allVarExpenses
        .filter(e => e && inMonth(e.date) && e.status !== 'pending')
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

    // Uscite fisse mensili (sommatoria di quelle attive)
    const monthFixed = allFixedExpenses
        .filter(e => e && (e.active !== false))
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

    if (balanceEl) balanceEl.textContent = fmtMoney(cassaBalance);
    if (incomeEl) incomeEl.textContent = fmtCompact(monthIncome);
    if (expenseEl) expenseEl.textContent = fmtCompact(monthVar + monthFixed);
    if (labelEl) labelEl.textContent = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

function computeAutoCalcValue(target) {
    if (!target.autoCalc || target.autoCalc === 'none') return null;
    const baseline = parseFloat(target.currentValue) || 0;
    const cutoff = target.autoCalcStartDate || target.startDate;
    const startDate = cutoff ? new Date(cutoff + 'T00:00:00') : null;
    const endDate = target.endDate ? new Date(target.endDate + 'T23:59:59') : null;
    const inRange = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d)) return false;
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
    };
    let delta = 0;
    if (target.autoCalc === 'incomeKraken') {
        delta = allIncome.filter(e => e && e.company === 'kraken' && inRange(e.date))
            .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    } else if (target.autoCalc === 'incomeGateradio') {
        delta = allIncome.filter(e => e && e.company === 'gateradio' && inRange(e.date))
            .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    } else if (target.autoCalc === 'liveStreams') {
        delta = allStreams.filter(s => s && inRange(s.date)).length;
    } else {
        return null;
    }
    return baseline + delta;
}

function renderLiveWidget() {
    const lastEl = document.getElementById('last-live');
    const kpiEl = document.getElementById('kpi-bars');
    if (!lastEl || !kpiEl) return;

    // Ultima live pubblicata (data più recente nel passato)
    const today = endOfDay(new Date());
    const past = allStreams
        .filter(s => s && s.date && new Date(s.date + 'T00:00:00') <= today)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const latest = past[0] || allStreams.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];

    if (latest) {
        const d = latest.date ? new Date(latest.date + 'T00:00:00') : null;
        const dateStr = d && !isNaN(d) ? d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : '';
        lastEl.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid fa-headphones"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs text-white/80">Ultima live</p>
                    <p class="text-sm font-bold truncate">${esc(latest.artist || latest.title || '—')}</p>
                    <p class="text-xs text-white/80">${esc(dateStr)}</p>
                </div>
            </div>`;
    } else {
        lastEl.innerHTML = `<p class="text-sm text-white/80 text-center py-2">Nessuna live pubblicata</p>`;
    }

    // KPI auto-calc (top 3)
    const autoTargets = allTargets.filter(t => t && t.autoCalc && t.autoCalc !== 'none').slice(0, 3);

    if (autoTargets.length === 0) {
        kpiEl.innerHTML = `<p class="text-xs text-white/80 text-center py-3">Nessun obiettivo auto-calcolato</p>`;
        return;
    }

    kpiEl.innerHTML = autoTargets.map(t => {
        const val = computeAutoCalcValue(t) ?? (parseFloat(t.currentValue) || 0);
        const target = parseFloat(t.targetValue) || 1;
        const progress = Math.min(100, Math.round((val / target) * 100));
        const isEuro = t.unit === '€';
        const display = isEuro ? fmtCompact(val) : `${val} ${t.unit || ''}`;
        const targetDisplay = isEuro ? fmtCompact(target) : `${target} ${t.unit || ''}`;
        return `
            <div>
                <div class="flex justify-between items-baseline text-xs mb-1">
                    <span class="font-semibold truncate pr-2">${esc(t.title)}</span>
                    <span class="text-white/80 whitespace-nowrap">${display} / ${targetDisplay}</span>
                </div>
                <div class="kpi-bar-outer">
                    <div class="kpi-bar-inner" style="width: ${progress}%"></div>
                </div>
            </div>`;
    }).join('');
}

function renderAll() {
    renderHeader();
    renderTodayWidget();
    renderWeekWidget();
    renderFinanzeWidget();
    renderLiveWidget();
}

function initFirebaseListeners() {
    onValue(ref(database, 'tasks'), snap => {
        allTasks = toArray(snap.val());
        renderAll();
    });
    onValue(ref(database, 'calendarEvents'), snap => {
        allEvents = toArray(snap.val());
        renderAll();
    });
    onValue(ref(database, 'incomeEntries'), snap => {
        allIncome = toArray(snap.val());
        renderAll();
    });
    onValue(ref(database, 'variableExpenses'), snap => {
        allVarExpenses = toArray(snap.val());
        renderAll();
    });
    onValue(ref(database, 'fixedExpenses'), snap => {
        allFixedExpenses = toArray(snap.val());
        renderAll();
    });
    onValue(ref(database, 'cassaComune/balance'), snap => {
        cassaBalance = parseFloat(snap.val()) || 0;
        renderAll();
    });
    onValue(ref(database, 'gateRadio/streams'), snap => {
        allStreams = toArray(snap.val());
        renderAll();
    });
    onValue(ref(database, 'targets'), snap => {
        allTargets = toArray(snap.val());
        renderAll();
    });
}

document.addEventListener('authReady', () => {
    renderHeader();
    initFirebaseListeners();
});
