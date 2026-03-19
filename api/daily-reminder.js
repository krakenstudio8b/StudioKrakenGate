// api/daily-reminder.js — Vercel cron: ogni giorno alle 11 avvisa scadenze
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

let db;

function getDb() {
    if (!db) {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (!getApps().length) {
            initializeApp({
                credential: cert(sa),
                databaseURL: 'https://studio-kraken-gate-default-rtdb.firebaseio.com'
            });
        }
        db = getDatabase();
    }
    return db;
}

webpush.setVapidDetails(
    'mailto:szczepanski.mateusz22@gmail.com',
    'BEM9r_9feFcJrCk10YTbK3kEOCUhN2B_p6CWJx-iejJCT2Oj-1UHl4IDw4c6UuL35wS0xPeBBejNSaDYVCWQtso',
    process.env.VAPID_PRIVATE_KEY
);

function getTomorrowStr() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

module.exports = async function handler(req, res) {
    const database = getDb();
    const tomorrow = getTomorrowStr();
    const today = getTodayStr();

    const [tasksSnap, subsSnap] = await Promise.all([
        database.ref('tasks').once('value'),
        database.ref('pushSubscriptions').once('value')
    ]);

    const tasks = Object.values(tasksSnap.val() || {}).filter(Boolean);
    const subscriptions = subsSnap.val() || {};

    const userMessages = {};
    const addMsg = (name, msg) => {
        const key = name.toLowerCase();
        if (!userMessages[key]) userMessages[key] = [];
        userMessages[key].push(msg);
    };

    tasks.forEach(task => {
        if (task.status === 'done') return;

        if (task.dueDate === tomorrow) {
            const users = [...(task.assignedTo || [])];
            if (task.owner && !users.includes(task.owner)) users.push(task.owner);
            users.forEach(name => addMsg(name, `📋 "${task.title}"`));
        }

        if (task.dueDate === today) {
            const users = [...(task.assignedTo || [])];
            if (task.owner && !users.includes(task.owner)) users.push(task.owner);
            users.forEach(name => addMsg(name, `🔴 OGGI: "${task.title}"`));
        }

        (task.checklist || []).forEach(item => {
            if (!item || item.done) return;
            if (item.dueDate !== tomorrow && item.dueDate !== today) return;

            const prefix = item.dueDate === today ? '🔴 OGGI' : 'domani';
            const msg = `✅ ${prefix}: "${item.text}" (${task.title})`;
            const assignee = item.assignee || '';

            if (assignee.toLowerCase() === 'tutti') {
                Object.keys(subscriptions).forEach(name => addMsg(name, msg));
            } else if (assignee) {
                addMsg(assignee, msg);
            }
        });
    });

    const sent = [];
    for (const [key, messages] of Object.entries(userMessages)) {
        const devicesData = subscriptions[key];
        if (!devicesData) continue;

        const body = messages.length === 1 ? messages[0] : `${messages.length} scadenze in arrivo`;
        const payload = JSON.stringify({ title: '⏰ Gateradio — Scadenze', body, url: '/index.html' });

        const devices = Object.entries(devicesData);
        for (const [deviceId, sub] of devices) {
            if (!sub || !sub.endpoint) continue;
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: sub.keys },
                    payload
                );
                sent.push(`${key}/${deviceId}`);
            } catch (err) {
                if (err.statusCode === 410) {
                    await database.ref(`pushSubscriptions/${key}/${deviceId}`).remove();
                }
            }
        }
    }

    return res.status(200).json({ ok: true, sent, tomorrow });
};
