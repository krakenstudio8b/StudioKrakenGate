// api/daily-reminder.js — Vercel cron: ogni mattina alle 8 avvisa scadenze del giorno dopo
import webpush from 'web-push';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

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
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
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

export default async function handler(req, res) {
    const database = getDb();
    const tomorrow = getTomorrowStr();
    const today = getTodayStr();

    const [tasksSnap, subsSnap] = await Promise.all([
        database.ref('tasks').once('value'),
        database.ref('pushSubscriptions').once('value')
    ]);

    const tasks = Object.values(tasksSnap.val() || {}).filter(Boolean);
    const subscriptions = subsSnap.val() || {};

    // Mappa: userName.toLowerCase() -> [messaggi]
    const userMessages = {};

    const addMsg = (name, msg) => {
        const key = name.toLowerCase();
        if (!userMessages[key]) userMessages[key] = [];
        userMessages[key].push(msg);
    };

    tasks.forEach(task => {
        if (task.status === 'done') return;

        // Task scadono domani
        if (task.dueDate === tomorrow) {
            const users = [...(task.assignedTo || [])];
            if (task.owner && !users.includes(task.owner)) users.push(task.owner);
            users.forEach(name => addMsg(name, `📋 "${task.title}"`));
        }

        // Task scaduti oggi (promemoria)
        if (task.dueDate === today) {
            const users = [...(task.assignedTo || [])];
            if (task.owner && !users.includes(task.owner)) users.push(task.owner);
            users.forEach(name => addMsg(name, `🔴 OGGI: "${task.title}"`));
        }

        // Checklist items in scadenza domani o oggi
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

    // Invia notifiche
    const sent = [];
    for (const [key, messages] of Object.entries(userMessages)) {
        const sub = subscriptions[key];
        if (!sub) continue;

        const body = messages.length === 1
            ? messages[0]
            : `${messages.length} scadenze in arrivo`;

        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: sub.keys },
                JSON.stringify({ title: '⏰ Gateradio — Scadenze', body, url: '/index.html' })
            );
            sent.push(key);
        } catch (err) {
            if (err.statusCode === 410) {
                await database.ref(`pushSubscriptions/${key}`).remove();
            }
        }
    }

    return res.status(200).json({ ok: true, sent, tomorrow });
}
