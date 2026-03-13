// js/eventi.js
import { database } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

document.addEventListener('authReady', () => {
    const eventsRef = ref(database, 'calendarEvents');
    const tasksRef  = ref(database, 'tasks');

    let allEvents = [];
    let allTasks  = [];
    let showPast  = false;

    const container      = document.getElementById('events-list');
    const statTotal      = document.getElementById('stat-total');
    const statWeek       = document.getElementById('stat-week');
    const statMonth      = document.getElementById('stat-month');
    const nextTitle      = document.getElementById('next-event-title');
    const nextDate       = document.getElementById('next-event-date');
    const togglePastBtn  = document.getElementById('toggle-past-btn');

    // --- HELPERS ---

    function getEventDate(event) {
        return new Date(event.start);
    }

    function getDaysUntil(event) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = getEventDate(event);
        d.setHours(0, 0, 0, 0);
        return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
    }

    function getEventType(event) {
        const title = (event.title || '').toLowerCase();
        if (title.includes('live'))                          return { label: 'LIVE',     icon: '🎙️', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200' };
        if (title.includes('riunione') || title.includes('meeting')) return { label: 'RIUNIONE', icon: '📋', bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200' };
        if (title.includes('prova') || title.includes('rehearsal'))  return { label: 'PROVA',    icon: '🎵', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' };
        if (title.includes('pulizie') || title.includes('pulizia'))  return { label: 'PULIZIE',  icon: '🧹', bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200' };
        if (title.includes('esterno') || (event.room || '').toLowerCase().includes('esterno')) return { label: 'ESTERNO', icon: '🏟️', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
        return { label: 'EVENTO', icon: '📅', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
    }

    function formatDateFull(event) {
        const d = getEventDate(event);
        const isAllDay = !event.start.includes('T');
        if (isAllDay) {
            return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
        return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    function formatTime(event) {
        if (!event.start.includes('T')) return 'Tutto il giorno';
        const d = getEventDate(event);
        let str = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        if (event.end && event.end.includes('T')) {
            const end = new Date(event.end);
            str += ' – ' + end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        }
        return str;
    }

    function getCountdownHtml(days) {
        if (days === 0)  return `<div class="countdown-badge bg-red-500 text-white flex-col"><span class="text-lg font-black leading-none">OGGI</span></div>`;
        if (days === 1)  return `<div class="countdown-badge bg-orange-400 text-white flex-col"><span class="text-sm font-bold leading-none">DOM.</span></div>`;
        if (days < 0)    return `<div class="countdown-badge bg-gray-200 text-gray-500 flex-col"><span class="text-lg font-black leading-none">${Math.abs(days)}</span><span class="text-[10px] uppercase tracking-wide">fa</span></div>`;
        const cls = days <= 7 ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700';
        return `<div class="countdown-badge ${cls} flex-col"><span class="text-2xl font-black leading-none">${days}</span><span class="text-[10px] uppercase tracking-wide">giorni</span></div>`;
    }

    // --- RENDER ---

    function render() {
        if (!container) return;
        container.innerHTML = '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sorted = [...allEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
        const future = sorted.filter(e => getEventDate(e) >= today);
        const past   = sorted.filter(e => getEventDate(e) < today).reverse();

        // Stats
        if (statTotal) statTotal.textContent = future.length;
        if (statWeek)  statWeek.textContent  = future.filter(e => getDaysUntil(e) <= 7).length;
        if (statMonth) statMonth.textContent = future.filter(e => getDaysUntil(e) <= 30).length;

        // Next event banner
        if (future.length > 0) {
            const next = future[0];
            if (nextTitle) nextTitle.textContent = next.title;
            if (nextDate)  nextDate.textContent  = formatDateFull(next) + (next.start.includes('T') ? ' alle ' + formatTime(next).split('–')[0].trim() : '');
        } else {
            if (nextTitle) nextTitle.textContent = 'Nessun evento in programma';
            if (nextDate)  nextDate.textContent  = '';
        }

        const toShow = showPast ? [...future, { _separator: true }, ...past] : future;

        if (toShow.filter(e => !e._separator).length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-center py-16 text-lg">Nessun evento in programma</p>';
            return;
        }

        let currentMonth = null;
        let pastSepShown = false;

        toShow.forEach(event => {
            // Separatore passati
            if (event._separator) {
                if (past.length === 0) return;
                const sep = document.createElement('div');
                sep.className = 'flex items-center gap-3 my-6';
                sep.innerHTML = `<div class="flex-1 h-px bg-gray-200"></div><span class="text-xs text-gray-400 font-semibold uppercase tracking-widest">Eventi passati</span><div class="flex-1 h-px bg-gray-200"></div>`;
                container.appendChild(sep);
                pastSepShown = true;
                currentMonth = null;
                return;
            }

            const eventDate = getEventDate(event);
            const monthKey  = eventDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

            if (monthKey !== currentMonth) {
                currentMonth = monthKey;
                const monthHeader = document.createElement('h3');
                monthHeader.className = 'text-xs font-bold uppercase tracking-widest text-gray-400 mt-6 mb-3 px-1';
                monthHeader.textContent = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);
                container.appendChild(monthHeader);
            }

            const days = getDaysUntil(event);
            const type = getEventType(event);
            const linkedTask = allTasks.find(t =>
                t.calendarEventId === event.id ||
                (event.googleEventId && t.googleCalendarEventId === event.googleEventId)
            );

            const taskStatusMap = {
                done:       { label: 'Fatto',    icon: '✅', cls: 'text-green-700 bg-green-50 border-green-200' },
                inprogress: { label: 'In corso', icon: '⏳', cls: 'text-orange-700 bg-orange-50 border-orange-200' },
                todo:       { label: 'Da fare',  icon: '📝', cls: 'text-indigo-700 bg-indigo-50 border-indigo-200' }
            };
            const taskStatus = linkedTask ? (taskStatusMap[linkedTask.status] || taskStatusMap.todo) : null;

            const taskHtml = linkedTask
                ? `<div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                     <i class="fa-solid fa-list-check text-gray-400 text-xs"></i>
                     <span class="text-xs text-gray-500">Attività collegata:</span>
                     <a href="index.html" class="text-xs font-medium text-indigo-600 hover:underline flex-1 truncate">${linkedTask.title}</a>
                     <span class="text-xs px-2 py-0.5 rounded-full border font-medium ${taskStatus.cls}">${taskStatus.icon} ${taskStatus.label}</span>
                   </div>`
                : '';

            const roomHtml = event.room
                ? `<span class="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5"><i class="fa-solid fa-location-dot text-[10px]"></i>${event.room}</span>`
                : '';

            const participantsHtml = (event.participants || []).length > 0
                ? `<span class="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5"><i class="fa-solid fa-users text-[10px]"></i>${event.participants.join(', ')}</span>`
                : '';

            const isPast = days < 0;

            const card = document.createElement('div');
            card.className = `event-card${isPast ? ' opacity-50' : ''}`;
            card.innerHTML = `
                <div class="event-countdown">
                    ${getCountdownHtml(days)}
                </div>
                <div class="event-body">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                        <span class="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${type.bg} ${type.text} ${type.border}">
                            ${type.icon} ${type.label}
                        </span>
                        <span class="text-xs text-gray-400"><i class="fa-regular fa-clock"></i> ${formatTime(event)}</span>
                    </div>
                    <h3 class="text-base font-bold text-gray-800 leading-snug">${event.title}</h3>
                    <div class="text-xs text-gray-500 mt-0.5 mb-2"><i class="fa-regular fa-calendar"></i> ${formatDateFull(event)}</div>
                    ${event.description ? `<p class="text-sm text-gray-600 mb-2 line-clamp-2">${event.description}</p>` : ''}
                    <div class="flex flex-wrap gap-2">${roomHtml}${participantsHtml}</div>
                    ${taskHtml}
                </div>
            `;
            container.appendChild(card);
        });
    }

    // --- LISTENERS ---

    onValue(eventsRef, (snapshot) => {
        allEvents = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => allEvents.push({ id: child.key, ...child.val() }));
        }
        // Debug visibile
        if (container) {
            const today = new Date(); today.setHours(0,0,0,0);
            const future = allEvents.filter(e => new Date(e.start) >= today);
            container.innerHTML = `<p class="text-xs text-gray-400 mb-4">Debug: ${allEvents.length} eventi totali in Firebase, ${future.length} futuri</p>`;
        }
        render();
    });

    onValue(tasksRef, (snapshot) => {
        const data = snapshot.val();
        if (Array.isArray(data)) allTasks = data;
        else if (typeof data === 'object' && data !== null) allTasks = Object.values(data);
        else allTasks = [];
        render();
    });

    if (togglePastBtn) {
        togglePastBtn.addEventListener('click', () => {
            showPast = !showPast;
            togglePastBtn.innerHTML = showPast
                ? '<i class="fa-solid fa-eye-slash"></i> Nascondi passati'
                : '<i class="fa-solid fa-clock-rotate-left"></i> Mostra passati';
            render();
        });
    }
});
