// js/notifications.js — Setup Web Push e invio notifiche
import { ref, set } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { database } from './firebase-config.js';

const VAPID_PUBLIC_KEY = 'BEM9r_9feFcJrCk10YTbK3kEOCUhN2B_p6CWJx-iejJCT2Oj-1UHl4IDw4c6UuL35wS0xPeBBejNSaDYVCWQtso';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function setupPushNotifications(uid, userName) {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        const subData = {
            endpoint: subscription.endpoint,
            keys: {
                auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
                p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh'))))
            },
            uid,
            savedAt: new Date().toISOString()
        };

        await set(ref(database, `pushSubscriptions/${userName.toLowerCase()}`), subData);
        console.log('✅ Push notifications attive per:', userName);
    } catch (err) {
        console.warn('Push setup fallito:', err);
    }
}

export async function sendNotification(type, payload) {
    const body = buildBody(type, payload);
    if (!body) return;

    try {
        await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch (err) {
        console.warn('Invio notifica fallito:', err);
    }
}

function buildBody(type, payload) {
    if (type === 'task_assigned') {
        return {
            title: '🎯 Nuovo task assegnato',
            body: `"${payload.taskTitle}"${payload.dueDate ? ` — scade il ${formatDate(payload.dueDate)}` : ''}`,
            targetUsers: payload.assignees,
            url: '/index.html'
        };
    }
    if (type === 'checklist_assigned') {
        return {
            title: '✅ Nuova sotto-attività',
            body: `"${payload.itemText}" in "${payload.taskTitle}"${payload.dueDate ? ` — scade il ${formatDate(payload.dueDate)}` : ''}`,
            targetUsers: [payload.assignee],
            url: '/index.html'
        };
    }
    return null;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}
