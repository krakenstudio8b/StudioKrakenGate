// api/r2-presign.js — Genera presigned PUT URL per upload diretto su R2
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const CORS_ORIGINS = [
    'https://studio-kraken-gate.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
];

function getCorsHeaders(origin) {
    const allowed = CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

module.exports = async function handler(req, res) {
    const origin = req.headers.origin || '';
    const cors = getCorsHeaders(origin);

    // Set CORS headers
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

    // Preflight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Auth: verifica token Firebase passato nell'header
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    if (!authToken) {
        return res.status(401).json({ error: 'Non autorizzato' });
    }

    // Verifica token Firebase tramite REST API
    try {
        const verifyRes = await fetch(
            `https://studio-kraken-gate-default-rtdb.firebaseio.com/users.json?auth=${authToken}&shallow=true`
        );
        if (!verifyRes.ok) {
            return res.status(401).json({ error: 'Token Firebase non valido' });
        }
    } catch {
        return res.status(401).json({ error: 'Errore verifica token' });
    }

    const { fileName, contentType, folder } = req.body || {};

    if (!fileName || !contentType) {
        return res.status(400).json({ error: 'fileName e contentType richiesti' });
    }

    // Genera nome file univoco
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFolder = (folder || 'uploads').replace(/[^a-zA-Z0-9._/ -]/g, '_');
    const key = `${safeFolder}/${timestamp}_${safeName}`;

    // Crea client S3 per R2
    const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });

    try {
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

        // URL pubblico per accedere al file dopo l'upload
        const publicUrl = `https://pub-41e721a087ea4a26b789322b03e6334d.r2.dev/${encodeURIComponent(safeFolder)}/${timestamp}_${encodeURIComponent(safeName)}`;

        return res.status(200).json({ presignedUrl, publicUrl, key });
    } catch (err) {
        console.error('R2 presign error:', err);
        return res.status(500).json({ error: 'Errore generazione URL di upload' });
    }
};
