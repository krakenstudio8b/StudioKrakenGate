// js/eventi.js
import { database, auth } from './firebase-config.js';
import { ref, onValue, get, set } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

let listenersReady = false;

onAuthStateChanged(auth, (user) => {
    if (!user || listenersReady) return;
    listenersReady = true;

    const eventsRef  = ref(database, 'calendarEvents');
    const tasksRef   = ref(database, 'tasks');
    const membersRef = ref(database, 'members');

    let allEvents   = [];
    let allTasks    = [];
    let allMembers  = [];
    let showPast    = false;
    let eventsReady = false;
    let tasksReady  = false;

    const container     = document.getElementById('events-list');
    const statTotal     = document.getElementById('stat-total');
    const statWeek      = document.getElementById('stat-week');
    const statMonth     = document.getElementById('stat-month');
    const nextTitle     = document.getElementById('next-event-title');
    const nextDate      = document.getElementById('next-event-date');
    const togglePastBtn = document.getElementById('toggle-past-btn');

    // --- HELPERS ---

    function getEventDate(event) {
        if (!event.start) return new Date(0);
        return new Date(event.start);
    }

    function getDaysUntil(event) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const d = getEventDate(event);
        const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return Math.ceil((local - today) / (1000 * 60 * 60 * 24));
    }

    function getEventType(event) {
        const title = (event.title || '').toLowerCase();
        if (title.includes('live'))                                                    return { label: 'LIVE',     icon: '🎙️', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200' };
        if (title.includes('riunione') || title.includes('meeting'))                   return { label: 'RIUNIONE', icon: '📋', bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200' };
        if (title.includes('prova') || title.includes('rehearsal'))                    return { label: 'PROVA',    icon: '🎵', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' };
        if (title.includes('pulizie') || title.includes('pulizia'))                    return { label: 'PULIZIE',  icon: '🧹', bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200' };
        if (title.includes('esterno') || (event.room || '').toLowerCase().includes('esterno')) return { label: 'ESTERNO', icon: '🏟️', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
        return { label: 'EVENTO', icon: '📅', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
    }

    function formatDateFull(event) {
        const d = getEventDate(event);
        return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    function formatTime(event) {
        const start = event.start || '';
        if (!start.includes('T')) return 'Tutto il giorno';
        const d = getEventDate(event);
        let str = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const end = event.end || '';
        if (end.includes('T')) {
            str += ' – ' + new Date(end).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
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

    // --- TASK HELPERS ---

    const priorityDot = { high: 'bg-red-500', medium: 'bg-orange-400', low: 'bg-blue-400' };

    function getEventLinkedTasks(eventId) {
        const event = allEvents.find(e => e.id === eventId);
        return allTasks.filter(t => !t.archived && (
            t.calendarEventId === eventId ||
            (event?.googleEventId && t.googleCalendarEventId === event.googleEventId)
        ));
    }

    function saveTasks() {
        set(tasksRef, allTasks);
    }

    function renderActivitiesPanel(eventId) {
        const panel = document.getElementById(`activities-panel-${eventId}`);
        if (!panel) return;

        const tasks = getEventLinkedTasks(eventId);

        const tasksHtml = tasks.map(task => {
            const checklist = task.checklist || [];
            const doneCount = checklist.filter(i => i.done).length;
            const checklistBadge = checklist.length > 0
                ? `<span class="text-[10px] text-gray-400 ml-1.5 shrink-0"><i class="fa-regular fa-square-check"></i> ${doneCount}/${checklist.length}</span>`
                : '';
            const dot = priorityDot[task.priority] || 'bg-gray-400';

            const statusButtons = [
                { s: 'todo',       label: 'Da fare',  activeClass: 'bg-gray-200 text-gray-700 border-gray-300',       hoverClass: 'hover:bg-gray-100 hover:text-gray-600' },
                { s: 'inprogress', label: 'In corso', activeClass: 'bg-orange-200 text-orange-700 border-orange-300', hoverClass: 'hover:bg-orange-50 hover:text-orange-600' },
                { s: 'done',       label: 'Fatto',    activeClass: 'bg-green-200 text-green-700 border-green-300',    hoverClass: 'hover:bg-green-50 hover:text-green-600' },
            ].map(({ s, label, activeClass, hoverClass }) => {
                const cls = task.status === s
                    ? `${activeClass} font-semibold`
                    : `bg-white text-gray-300 border-gray-200 ${hoverClass}`;
                return `<button class="task-status-btn text-[10px] px-1.5 py-0.5 rounded-full border transition-all ${cls}" data-task-id="${task.id}" data-status="${s}">${label}</button>`;
            }).join('');

            return `
                <div class="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                    <span class="w-2 h-2 rounded-full shrink-0 ${dot}"></span>
                    <div class="flex-1 min-w-0 flex items-center">
                        <span class="text-sm text-gray-800 truncate">${task.title}</span>${checklistBadge}
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        ${statusButtons}
                        <button class="delete-event-task-btn text-gray-300 hover:text-red-500 ml-1 transition-colors" data-task-id="${task.id}" title="Elimina">
                            <i class="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </div>
                </div>`;
        }).join('');

        panel.innerHTML = `
            <div class="space-y-1.5 mb-2">
                ${tasks.length > 0 ? tasksHtml : '<p class="text-xs text-gray-400 italic py-1 px-1">Nessuna attività collegata</p>'}
            </div>
            <div id="add-task-fc-${eventId}">
                <button class="show-add-task-btn text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1 mt-1 transition-colors" data-event-id="${eventId}">
                    <i class="fa-solid fa-plus text-[10px]"></i> Aggiungi attività
                </button>
                <div class="add-task-inline-form hidden mt-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <input type="text" class="new-task-title-input w-full text-sm p-2 border border-gray-200 rounded-lg mb-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Titolo attività..." data-event-id="${eventId}">
                    <div class="flex gap-2 items-center flex-wrap">
                        <select class="new-task-priority-select text-xs p-1.5 border border-gray-200 rounded-lg bg-white">
                            <option value="low">Bassa priorità</option>
                            <option value="medium" selected>Media priorità</option>
                            <option value="high">Alta priorità</option>
                        </select>
                        <button class="save-new-task-btn text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium" data-event-id="${eventId}">Salva</button>
                        <button class="cancel-add-task-btn text-xs text-gray-500 hover:text-gray-700 transition-colors" data-event-id="${eventId}">Annulla</button>
                    </div>
                </div>
            </div>`;
    }

    function updateActivityCountBadge(eventId) {
        const btn = container?.querySelector(`.toggle-activities-btn[data-event-id="${eventId}"]`);
        if (!btn) return;
        const count = getEventLinkedTasks(eventId).length;
        let badge = btn.querySelector('.activity-count-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'activity-count-badge inline-flex items-center justify-center bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full w-4 h-4';
                const chevron = btn.querySelector('.toggle-chevron');
                btn.insertBefore(badge, chevron);
            }
            badge.textContent = count;
        } else if (badge) {
            badge.remove();
        }
    }

    // --- RENDER ---

    function render() {
        if (!container) return;
        container.innerHTML = '';

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const sorted = [...allEvents].sort((a, b) => {
            const da = a.start ? new Date(a.start) : new Date(0);
            const db = b.start ? new Date(b.start) : new Date(0);
            return da - db;
        });

        const future = sorted.filter(e => {
            const d = getEventDate(e);
            const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            return local >= today;
        });
        const past = sorted.filter(e => {
            const d = getEventDate(e);
            const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            return local < today;
        }).reverse();

        // Stats
        const futureStat = sorted.filter(e => getDaysUntil(e) >= 0);
        if (statTotal) statTotal.textContent = futureStat.length;
        if (statWeek)  statWeek.textContent  = futureStat.filter(e => getDaysUntil(e) <= 7).length;
        if (statMonth) statMonth.textContent = futureStat.filter(e => getDaysUntil(e) <= 30).length;

        // Next event banner
        if (future.length > 0) {
            const next = future[0];
            if (nextTitle) nextTitle.textContent = next.title;
            if (nextDate)  nextDate.textContent  = formatDateFull(next) + ((next.start || '').includes('T') ? ' alle ' + formatTime(next).split('–')[0].trim() : '');
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

        toShow.forEach(event => { try {
            if (event._separator) {
                if (past.length === 0) return;
                const sep = document.createElement('div');
                sep.className = 'flex items-center gap-3 my-6';
                sep.innerHTML = `<div class="flex-1 h-px bg-gray-200"></div><span class="text-xs text-gray-400 font-semibold uppercase tracking-widest">Eventi passati</span><div class="flex-1 h-px bg-gray-200"></div>`;
                container.appendChild(sep);
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

            const days     = getDaysUntil(event);
            const type     = getEventType(event);
            const isPast   = days < 0;
            const linkedCount = getEventLinkedTasks(event.id).length;

            const roomHtml = event.room
                ? `<span class="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5"><i class="fa-solid fa-location-dot text-[10px]"></i>${event.room}</span>`
                : '';

            const participantsHtml = (event.participants || []).length > 0
                ? `<span class="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5"><i class="fa-solid fa-users text-[10px]"></i>${event.participants.join(', ')}</span>`
                : '';

            const countBadge = linkedCount > 0
                ? `<span class="activity-count-badge inline-flex items-center justify-center bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full w-4 h-4">${linkedCount}</span>`
                : '';

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
                    <div class="flex flex-wrap gap-2 mb-3">${roomHtml}${participantsHtml}</div>
                    <div class="pt-2.5 border-t border-gray-100">
                        <button class="toggle-activities-btn flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-indigo-500 hover:text-indigo-700 transition-colors" data-event-id="${event.id}">
                            <i class="fa-solid fa-list-check"></i>
                            ATTIVITÀ
                            ${countBadge}
                            <i class="fa-solid fa-chevron-down text-[9px] ml-0.5 toggle-chevron transition-transform duration-200"></i>
                        </button>
                        <div class="activities-panel hidden mt-2" id="activities-panel-${event.id}" data-event-id="${event.id}"></div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        } catch(err) { console.error('Errore render evento:', event?.title, err); } });
    }

    // --- EVENT DELEGATION ---

    if (container) {
        container.addEventListener('click', (e) => {

            // Toggle activities panel
            const toggleBtn = e.target.closest('.toggle-activities-btn');
            if (toggleBtn) {
                const eventId = toggleBtn.dataset.eventId;
                const panel = document.getElementById(`activities-panel-${eventId}`);
                if (!panel) return;
                const opening = panel.classList.contains('hidden');
                panel.classList.toggle('hidden', !opening);
                const chevron = toggleBtn.querySelector('.toggle-chevron');
                if (chevron) chevron.classList.toggle('rotate-180', opening);
                if (opening) renderActivitiesPanel(eventId);
                return;
            }

            // Show add task form
            const showAddBtn = e.target.closest('.show-add-task-btn');
            if (showAddBtn) {
                const eventId = showAddBtn.dataset.eventId;
                const fc = document.getElementById(`add-task-fc-${eventId}`);
                if (!fc) return;
                fc.querySelector('.show-add-task-btn')?.classList.add('hidden');
                const form = fc.querySelector('.add-task-inline-form');
                form?.classList.remove('hidden');
                fc.querySelector('.new-task-title-input')?.focus();
                return;
            }

            // Cancel add task form
            const cancelBtn = e.target.closest('.cancel-add-task-btn');
            if (cancelBtn) {
                const eventId = cancelBtn.dataset.eventId;
                const fc = document.getElementById(`add-task-fc-${eventId}`);
                if (!fc) return;
                fc.querySelector('.add-task-inline-form')?.classList.add('hidden');
                fc.querySelector('.show-add-task-btn')?.classList.remove('hidden');
                return;
            }

            // Save new task
            const saveBtn = e.target.closest('.save-new-task-btn');
            if (saveBtn) {
                const eventId = saveBtn.dataset.eventId;
                const fc = document.getElementById(`add-task-fc-${eventId}`);
                if (!fc) return;
                const titleInput    = fc.querySelector('.new-task-title-input');
                const prioritySelect = fc.querySelector('.new-task-priority-select');
                const title = titleInput?.value.trim();
                if (!title) { titleInput?.focus(); return; }

                const now = Date.now();
                const newTask = {
                    id: now.toString(),
                    title,
                    description: '',
                    priority: prioritySelect?.value || 'medium',
                    status: 'todo',
                    calendarEventId: eventId,
                    owner: '',
                    assignedTo: [],
                    checklist: [],
                    comments: [],
                    createdAt: new Date(now).toISOString(),
                    archived: false
                };
                allTasks.push(newTask);
                saveTasks();
                renderActivitiesPanel(eventId);
                updateActivityCountBadge(eventId);
                return;
            }

            // Change task status
            const statusBtn = e.target.closest('.task-status-btn');
            if (statusBtn) {
                e.stopPropagation();
                const taskId   = statusBtn.dataset.taskId;
                const newStatus = statusBtn.dataset.status;
                const task = allTasks.find(t => t.id === taskId);
                if (!task || task.status === newStatus) return;
                task.status = newStatus;
                saveTasks();
                if (task.calendarEventId) {
                    renderActivitiesPanel(task.calendarEventId);
                    updateActivityCountBadge(task.calendarEventId);
                }
                return;
            }

            // Delete task
            const deleteBtn = e.target.closest('.delete-event-task-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const taskId = deleteBtn.dataset.taskId;
                const task = allTasks.find(t => t.id === taskId);
                if (!task || !confirm('Eliminare questa attività?')) return;
                const eventId = task.calendarEventId;
                allTasks = allTasks.filter(t => t.id !== taskId);
                saveTasks();
                if (eventId) {
                    renderActivitiesPanel(eventId);
                    updateActivityCountBadge(eventId);
                }
                return;
            }
        });

        // Enter su input nuovo task
        container.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('new-task-title-input')) {
                const eventId = e.target.dataset.eventId;
                document.getElementById(`add-task-fc-${eventId}`)?.querySelector('.save-new-task-btn')?.click();
            }
        });
    }

    // --- DATA LOADING ---

    function tryRender() {
        if (eventsReady && tasksReady) render();
    }

    // Tasks: onValue per sincronizzazione in tempo reale
    onValue(tasksRef, (snapshot) => {
        const data = snapshot.val();
        if (Array.isArray(data)) allTasks = data;
        else if (typeof data === 'object' && data !== null) allTasks = Object.values(data);
        else allTasks = [];
        tasksReady = true;
        tryRender();
        // Aggiorna i pannelli già aperti
        document.querySelectorAll('.activities-panel:not(.hidden)').forEach(panel => {
            const eid = panel.dataset.eventId;
            if (eid) {
                renderActivitiesPanel(eid);
                updateActivityCountBadge(eid);
            }
        });
    });

    onValue(membersRef, (snapshot) => {
        const data = snapshot.val() || {};
        allMembers = Object.values(data).map(m => m.name).filter(Boolean);
    });

    // Events: get() una tantum (come da implementazione precedente)
    async function loadData() {
        try {
            const evSnap = await get(eventsRef);
            allEvents = [];
            if (evSnap.exists()) {
                evSnap.forEach(child => { allEvents.push({ id: child.key, ...child.val() }); });
            }
            eventsReady = true;
            tryRender();
        } catch(err) {
            console.error('[eventi] errore caricamento:', err);
            if (container) container.innerHTML = `<p class="text-red-500 p-4">Errore caricamento dati: ${err.message}</p>`;
        }
    }

    loadData();

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
