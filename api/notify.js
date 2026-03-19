// api/notify.js — Vercel serverless function: invia Web Push a utenti specifici
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
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { title, body, targetUsers, url } = req.body;

    if (!title || !targetUsers || !Array.isArray(targetUsers) || targetUsers.length === 0) {
        return res.status(400).json({ error: 'title e targetUsers sono obbligatori' });
    }

    const database = getDb();
    const results = [];

    for (const userName of targetUsers) {
        const key = userName.toLowerCase();
        const snap = await database.ref(`pushSubscriptions/${key}`).once('value');
        const sub = snap.val();
        if (!sub) {
            results.push({ user: userName, sent: false, error: 'no subscription' });
            continue;
        }

        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: sub.keys },
                JSON.stringify({ title, body: body || '', url: url || '/index.html' })
            );
            results.push({ user: userName, sent: true });
        } catch (err) {
            if (err.statusCode === 410) {
                await database.ref(`pushSubscriptions/${key}`).remove();
            }
            results.push({ user: userName, sent: false, error: err.message });
        }
    }

    return res.status(200).json({ results });
};
