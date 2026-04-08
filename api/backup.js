// api/backup.js — Vercel cron: backup giornaliero automatico dei dati critici
// Schedule: ogni giorno alle 03:00 UTC (vedi vercel.json)
// Nodi inclusi: cassaComune, variableExpenses, fixedExpenses, incomeEntries, members, targets
// Retention: ultimi 30 backup (quelli più vecchi vengono eliminati)

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getDatabase }                   = require('firebase-admin/database');

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

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();

    // Accettato da: cron Vercel (header x-vercel-cron-signature) OPPURE token manuale
    const isVercelCron = typeof req.headers['x-vercel-cron-signature'] === 'string';
    const token = req.headers['x-backup-token'] || req.query.token;
    if (!isVercelCron && token !== process.env.BACKUP_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const database = getDb();
    const today = new Date().toISOString().split('T')[0];

    try {
        // Leggi i nodi critici in parallelo
        const [cassaSnap, varExpSnap, fixedExpSnap, incomeSnap, membersSnap, targetsSnap] =
            await Promise.all([
                database.ref('cassaComune').once('value'),
                database.ref('variableExpenses').once('value'),
                database.ref('fixedExpenses').once('value'),
                database.ref('incomeEntries').once('value'),
                database.ref('members').once('value'),
                database.ref('targets').once('value')
            ]);

        const snapshot = {
            date:             today,
            createdAt:        new Date().toISOString(),
            cassaComune:      cassaSnap.val(),
            variableExpenses: varExpSnap.val(),
            fixedExpenses:    fixedExpSnap.val(),
            incomeEntries:    incomeSnap.val(),
            members:          membersSnap.val(),
            targets:          targetsSnap.val()
        };

        // Salva il backup del giorno
        await database.ref(`backups/${today}`).set(snapshot);

        // Purga backup più vecchi di 30 giorni
        const backupsSnap  = await database.ref('backups').once('value');
        const allKeys      = Object.keys(backupsSnap.val() || {}).sort(); // ordinati per data YYYY-MM-DD
        const deleteCount  = Math.max(0, allKeys.length - 30);
        const toDelete     = allKeys.slice(0, deleteCount);

        for (const dateKey of toDelete) {
            await database.ref(`backups/${dateKey}`).remove();
        }

        return res.status(200).json({ ok: true, date: today, purged: toDelete.length });

    } catch (err) {
        console.error('[Backup] Errore:', err);
        return res.status(500).json({ error: err.message });
    }
};
