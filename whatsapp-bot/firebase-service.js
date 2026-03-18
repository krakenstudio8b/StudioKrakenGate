// firebase-service.js

const admin = require('firebase-admin');
const path  = require('path');

let db = null;

function initFirebase() {
    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        // Railway / cloud: chiave passata come variabile d'ambiente
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        console.log('[Firebase] Credenziali caricate da variabile d\'ambiente');
    } else {
        // Locale: legge dal file
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account-key.json';
        serviceAccount = require(path.resolve(serviceAccountPath));
        console.log('[Firebase] Credenziali caricate da file');
    }

    admin.initializeApp({
        credential:  admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    db = admin.database();
    console.log('[Firebase] Connesso al database');
    return db;
}

function getDb() {
    if (!db) throw new Error('Firebase non inizializzato. Chiama initFirebase() prima.');
    return db;
}

// ── TASK ─────────────────────────────────────────────────────

async function getTasks() {
    const snapshot = await getDb().ref('tasks').once('value');
    const data = snapshot.val();
    if (Array.isArray(data))                       return data.filter(Boolean);
    if (data && typeof data === 'object')           return Object.values(data);
    return [];
}

async function getTasksDueToday() {
    const today = new Date().toISOString().split('T')[0];
    return (await getTasks()).filter(t => t.dueDate === today && t.status !== 'done');
}

async function getTasksDueTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    return (await getTasks()).filter(t => t.dueDate === tomorrowStr && t.status !== 'done');
}

async function getOverdueTasks() {
    const today = new Date().toISOString().split('T')[0];
    return (await getTasks()).filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
}

async function getTasksDueThisWeek() {
    const tasks   = await getTasks();
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const endWeek = new Date(today); endWeek.setDate(today.getDate() + (7 - today.getDay())); endWeek.setHours(23, 59, 59, 999);
    const todayStr = today.toISOString().split('T')[0];
    return tasks.filter(t =>
        t.dueDate &&
        t.dueDate >= todayStr &&
        new Date(t.dueDate + 'T00:00:00') <= endWeek &&
        t.status !== 'done'
    );
}

async function getTasksThisMonth() {
    const now     = new Date();
    const prefix  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return (await getTasks()).filter(t => t.dueDate && t.dueDate.startsWith(prefix) && t.status !== 'done');
}

async function getTasksCompletedLastWeek() {
    const tasks = await getTasks();
    const now   = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfThisWeek.setHours(0, 0, 0, 0);
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    return tasks.filter(t => {
        if (t.status !== 'done' || !t.completedAt) return false;
        const completed = new Date(t.completedAt);
        return completed >= startOfLastWeek && completed < startOfThisWeek;
    });
}

async function getCompletedTasks() {
    return (await getTasks()).filter(t => t.status === 'done');
}

async function updateTaskStatus(taskId, newStatus) {
    const tasks     = await getTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return null;
    tasks[taskIndex].status = newStatus;
    if (newStatus === 'done') {
        tasks[taskIndex].completedAt = new Date().toISOString();
    }
    await getDb().ref('tasks').set(tasks);
    return tasks[taskIndex];
}

async function findTasksByName(searchText) {
    const search = searchText.toLowerCase();
    return (await getTasks()).filter(t => t.status !== 'done' && t.title.toLowerCase().includes(search));
}

async function findChecklistItemsByName(searchText) {
    const tasks   = await getTasks();
    const search  = searchText.toLowerCase();
    const results = [];
    tasks.forEach(task => {
        if (task.status === 'done' || !task.checklist) return;
        task.checklist.forEach((item, index) => {
            if (!item.done && item.text.toLowerCase().includes(search)) {
                results.push({ taskId: task.id, taskTitle: task.title, itemIndex: index, item, checklist: task.checklist });
            }
        });
    });
    return results;
}

async function completeChecklistItem(taskId, itemIndex) {
    const tasks = await getTasks();
    const task  = tasks.find(t => t.id === taskId);
    if (!task || !task.checklist || !task.checklist[itemIndex]) return { success: false, error: 'Attività non trovata' };
    const item = task.checklist[itemIndex];
    if (item.locked && itemIndex > 0 && !task.checklist[itemIndex - 1].done) {
        return { success: false, error: `Devi prima completare: "${task.checklist[itemIndex - 1].text}"` };
    }
    task.checklist[itemIndex].done = true;
    await getDb().ref('tasks').set(tasks);
    return { success: true, task, item };
}

// ── CHECKLIST ─────────────────────────────────────────────────

async function getChecklistItemsDueToday() {
    const tasks   = await getTasks();
    const today   = new Date().toISOString().split('T')[0];
    const items   = [];
    tasks.forEach(task => {
        if (task.status === 'done' || !task.checklist) return;
        task.checklist.forEach(item => {
            if (item.dueDate === today && !item.done) {
                items.push({ taskTitle: task.title, text: item.text, assignee: item.assignee || '', dueDate: item.dueDate });
            }
        });
    });
    return items;
}

async function getChecklistItemsDueThisWeek() {
    const tasks   = await getTasks();
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const endWeek = new Date(today); endWeek.setDate(today.getDate() + (7 - today.getDay())); endWeek.setHours(23, 59, 59, 999);
    const todayStr = today.toISOString().split('T')[0];
    const items   = [];
    tasks.forEach(task => {
        if (task.status === 'done' || !task.checklist) return;
        task.checklist.forEach(item => {
            if (!item.dueDate || item.done) return;
            const due = new Date(item.dueDate + 'T00:00:00');
            if (item.dueDate >= todayStr && due <= endWeek) {
                items.push({ taskTitle: task.title, text: item.text, assignee: item.assignee || '', dueDate: item.dueDate });
            }
        });
    });
    items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return items;
}

// ── EVENTI CALENDARIO ─────────────────────────────────────────

async function getCalendarEvents() {
    const snapshot = await getDb().ref('calendarEvents').once('value');
    const data = snapshot.val();
    if (!data) return [];
    return Object.entries(data).map(([key, val]) => ({ id: key, ...val }));
}

async function getEventsForDate(dateStr) {
    const events = await getCalendarEvents();
    return events.filter(e => e.start && e.start.split('T')[0] === dateStr);
}

// ── MEMBRI ────────────────────────────────────────────────────

async function getMembers() {
    const snapshot = await getDb().ref('members').once('value');
    const data = snapshot.val() || {};
    return Object.entries(data).map(([uid, member]) => ({ uid, name: member.name, ...member }));
}

// ── UTILITY ───────────────────────────────────────────────────

function groupTasksByMember(tasks) {
    const grouped = {};
    tasks.forEach(task => {
        const assignees = [...(task.assignedTo || [])];
        if (task.owner && !assignees.includes(task.owner)) assignees.push(task.owner);
        assignees.forEach(member => {
            if (!grouped[member]) grouped[member] = [];
            grouped[member].push(task);
        });
    });
    return grouped;
}

async function enrichTasksWithEvents(tasks) {
    if (!tasks.length) return tasks;
    const events   = await getCalendarEvents();
    const eventMap = {};
    events.forEach(e => { eventMap[e.id] = e.title; });
    return tasks.map(t =>
        t.calendarEventId && eventMap[t.calendarEventId]
            ? { ...t, _eventName: eventMap[t.calendarEventId] }
            : t
    );
}

function onValueChange(path, callback) {
    getDb().ref(path).on('value', snapshot => callback(snapshot.val()));
}

module.exports = {
    initFirebase,
    getDb,
    getTasks,
    getTasksDueToday,
    getTasksDueTomorrow,
    getOverdueTasks,
    getTasksDueThisWeek,
    getTasksThisMonth,
    getTasksCompletedLastWeek,
    getCompletedTasks,
    updateTaskStatus,
    findTasksByName,
    findChecklistItemsByName,
    completeChecklistItem,
    getChecklistItemsDueToday,
    getChecklistItemsDueThisWeek,
    getCalendarEvents,
    getEventsForDate,
    getMembers,
    groupTasksByMember,
    enrichTasksWithEvents,
    onValueChange
};
