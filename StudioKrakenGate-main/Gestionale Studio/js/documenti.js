// js/documenti.js - Gestione documenti Google Drive
import { GOOGLE_CONFIG } from './google-calendar-config.js';

// --- RIFERIMENTI DOM ---
const authorizeBtn = document.getElementById('authorize-btn');
const refreshBtn = document.getElementById('refresh-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const authSection = document.getElementById('auth-section');
const documentsSection = document.getElementById('documents-section');
const loadingSection = document.getElementById('loading-section');
const documentsList = document.getElementById('documents-list');
const noDocuments = document.getElementById('no-documents');
const uploadModal = document.getElementById('upload-modal');
const uploadProgress = document.getElementById('upload-progress');
const uploadComplete = document.getElementById('upload-complete');
const closeUploadModal = document.getElementById('close-upload-modal');
const progressBar = document.getElementById('progress-bar');
const uploadStatus = document.getElementById('upload-status');

// --- STATO GLOBALE ---
let tokenClient;
let gapiInited = false;
let gisInited = false;

// --- INIZIALIZZAZIONE ---
// Aspetta che sia Firebase che Google siano pronti
let firebaseReady = false;
document.addEventListener('authReady', () => {
    console.log('Firebase auth ready');
    firebaseReady = true;
    maybeEnableButtons();
});

// Inizializza GAPI quando il documento è pronto
function initGapi() {
    console.log('Inizializzazione GAPI...');
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                discoveryDocs: [GOOGLE_CONFIG.DRIVE_DISCOVERY_DOC]
            });
            console.log('GAPI client inizializzato');
            gapiInited = true;
            maybeEnableButtons();
        } catch (error) {
            console.error('Errore inizializzazione GAPI:', error);
            alert('Errore durante l\'inizializzazione di Google Drive API. Assicurati di aver abilitato l\'API nella console Google Cloud.');
        }
    });
}

// Inizializza GIS quando il documento è pronto
function initGis() {
    console.log('Inizializzazione Google Identity Services...');
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CONFIG.CLIENT_ID,
            scope: GOOGLE_CONFIG.DRIVE_SCOPES,
            callback: '' // definito in seguito
        });
        console.log('Token client inizializzato');
        gisInited = true;
        maybeEnableButtons();
    } catch (error) {
        console.error('Errore inizializzazione GIS:', error);
        alert('Errore durante l\'inizializzazione dell\'autenticazione Google.');
    }
}

// Espone le funzioni globalmente per gli script Google
window.initGapi = initGapi;
window.initGis = initGis;

// Prova a inizializzare quando la pagina è caricata
window.addEventListener('load', () => {
    console.log('Pagina caricata, tentativo inizializzazione...');

    // Attendi che gapi sia disponibile
    const waitForGapi = setInterval(() => {
        if (typeof gapi !== 'undefined') {
            clearInterval(waitForGapi);
            initGapi();
        }
    }, 100);

    // Attendi che Google Identity Services sia disponibile
    const waitForGis = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts) {
            clearInterval(waitForGis);
            initGis();
        }
    }, 100);
});

// Abilita i pulsanti quando tutto è pronto
function maybeEnableButtons() {
    console.log('Controllo: Firebase =', firebaseReady, ', GAPI =', gapiInited, ', GIS =', gisInited);
    if (firebaseReady && gapiInited && gisInited) {
        console.log('Tutto pronto! Pulsante autorizzazione abilitato.');
        authorizeBtn.disabled = false;
    }
}

// --- AUTENTICAZIONE ---
authorizeBtn.addEventListener('click', handleAuthClick);

function handleAuthClick() {
    console.log('Bottone autenticazione cliccato');

    if (!tokenClient) {
        console.error('Token client non inizializzato');
        alert('Errore: sistema di autenticazione non pronto. Ricarica la pagina.');
        return;
    }

    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            console.error('Errore autenticazione:', resp);
            alert('Errore durante l\'autenticazione con Google Drive.');
            return;
        }

        console.log('Autenticazione riuscita!');
        // Autenticazione riuscita
        authSection.classList.add('hidden');
        documentsSection.classList.remove('hidden');
        refreshBtn.classList.remove('hidden');
        uploadBtn.classList.remove('hidden');

        // Carica i documenti
        await listDocuments();
    };

    // Controlla se abbiamo già un token valido
    if (gapi.client.getToken() === null) {
        console.log('Nessun token presente, richiesta nuovo token...');
        // Richiedi un nuovo token
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        console.log('Token già presente, utilizzo token esistente');
        // Abbiamo già un token, usa quello
        authSection.classList.add('hidden');
        documentsSection.classList.remove('hidden');
        refreshBtn.classList.remove('hidden');
        uploadBtn.classList.remove('hidden');
        listDocuments();
    }
}

// --- LISTA DOCUMENTI ---
async function listDocuments() {
    loadingSection.classList.remove('hidden');
    documentsList.classList.add('hidden');
    noDocuments.classList.add('hidden');

    try {
        let query = "trashed=false";

        // Se è specificata una cartella, filtra per quella
        if (GOOGLE_CONFIG.DRIVE_FOLDER_ID) {
            query += ` and '${GOOGLE_CONFIG.DRIVE_FOLDER_ID}' in parents`;
        } else {
            // Mostra solo i file condivisi con me o di mia proprietà
            query += " and (sharedWithMe=true or 'me' in owners)";
        }

        const response = await gapi.client.drive.files.list({
            q: query,
            pageSize: 100,
            orderBy: 'modifiedTime desc',
            fields: 'files(id, name, mimeType, modifiedTime, iconLink, webViewLink, webContentLink, size, owners)',
        });

        const files = response.result.files;

        if (!files || files.length === 0) {
            loadingSection.classList.add('hidden');
            noDocuments.classList.remove('hidden');
            return;
        }

        renderDocuments(files);
        loadingSection.classList.add('hidden');
        documentsList.classList.remove('hidden');
    } catch (error) {
        console.error('Errore caricamento documenti:', error);
        loadingSection.classList.add('hidden');
        alert('Errore durante il caricamento dei documenti.');
    }
}

// Renderizza la lista dei documenti
function renderDocuments(files) {
    documentsList.innerHTML = '';

    files.forEach(file => {
        const fileCard = createFileCard(file);
        documentsList.appendChild(fileCard);
    });
}

// Crea la card per un singolo file
function createFileCard(file) {
    const card = document.createElement('div');
    const isFolderType = isFolder(file.mimeType);

    // Stile diverso per cartelle
    const cardClasses = isFolderType
        ? 'card hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full border-2 border-amber-400 bg-amber-50'
        : 'card hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full';

    card.className = cardClasses;

    const icon = getFileIcon(file.mimeType);
    const iconColor = isFolderType ? 'text-amber-500' : 'text-indigo-600';
    const fileSize = file.size ? formatFileSize(parseInt(file.size)) : 'N/A';
    const modifiedDate = new Date(file.modifiedTime).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    const owner = file.owners && file.owners[0] ? file.owners[0].displayName : 'Sconosciuto';

    card.innerHTML = `
        <div class="flex flex-col items-center text-center flex-grow">
            ${isFolderType ? '<span class="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full mb-2">CARTELLA</span>' : ''}
            <div class="mb-3">
                <i class="${icon} text-5xl ${iconColor}"></i>
            </div>
            <h3 class="text-base font-semibold mb-2 px-2 line-clamp-2" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</h3>
            <div class="flex flex-col gap-1 text-xs text-gray-600 mb-4 w-full px-2">
                <span class="truncate"><i class="fas fa-user mr-1"></i>${escapeHtml(owner)}</span>
                <span><i class="fas fa-clock mr-1"></i>${modifiedDate}</span>
                ${!isFolderType ? `<span><i class="fas fa-database mr-1"></i>${fileSize}</span>` : ''}
            </div>
        </div>
        <div class="flex flex-col gap-2 mt-auto border-t pt-3">
            ${isFolderType ? `
                <button onclick="window.open('${file.webViewLink}', '_blank')"
                        class="bg-amber-500 text-white text-xs font-semibold py-2 px-3 rounded hover:bg-amber-600 transition-colors w-full">
                    <i class="fas fa-folder-open mr-1"></i>Apri Cartella
                </button>
            ` : `
                ${file.webViewLink ? `
                    <button onclick="window.open('${file.webViewLink}', '_blank')"
                            class="bg-indigo-500 text-white text-xs font-semibold py-2 px-3 rounded hover:bg-indigo-600 transition-colors w-full">
                        <i class="fas fa-eye mr-1"></i>Visualizza
                    </button>
                ` : ''}
                ${isGoogleDoc(file.mimeType) ? `
                    <button onclick="window.open('${file.webViewLink}', '_blank')"
                            class="bg-green-500 text-white text-xs font-semibold py-2 px-3 rounded hover:bg-green-600 transition-colors w-full">
                        <i class="fas fa-edit mr-1"></i>Modifica
                    </button>
                ` : ''}
                ${file.webContentLink ? `
                    <a href="${file.webContentLink}"
                       class="bg-blue-500 text-white text-xs font-semibold py-2 px-3 rounded hover:bg-blue-600 transition-colors inline-block text-center w-full">
                        <i class="fas fa-download mr-1"></i>Scarica
                    </a>
                ` : ''}
            `}
        </div>
    `;

    return card;
}

// Determina l'icona in base al tipo MIME
function getFileIcon(mimeType) {
    // Cartelle
    if (mimeType === 'application/vnd.google-apps.folder') {
        return 'fas fa-folder';
    } else if (mimeType.includes('document') || mimeType.includes('word')) {
        return 'fas fa-file-word';
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
        return 'fas fa-file-excel';
    } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
        return 'fas fa-file-powerpoint';
    } else if (mimeType.includes('pdf')) {
        return 'fas fa-file-pdf';
    } else if (mimeType.includes('image')) {
        return 'fas fa-file-image';
    } else if (mimeType.includes('video')) {
        return 'fas fa-file-video';
    } else if (mimeType.includes('audio')) {
        return 'fas fa-file-audio';
    } else if (mimeType.includes('zip') || mimeType.includes('archive')) {
        return 'fas fa-file-archive';
    } else if (mimeType.includes('text')) {
        return 'fas fa-file-alt';
    } else {
        return 'fas fa-file';
    }
}

// Controlla se è una cartella
function isFolder(mimeType) {
    return mimeType === 'application/vnd.google-apps.folder';
}

// Controlla se è un documento Google nativo
function isGoogleDoc(mimeType) {
    return mimeType.includes('google-apps.document') ||
           mimeType.includes('google-apps.spreadsheet') ||
           mimeType.includes('google-apps.presentation');
}

// Formatta la dimensione del file
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Escape HTML per prevenire XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- UPLOAD FILE ---
uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Mostra il modale di upload
    uploadModal.classList.remove('hidden');
    uploadProgress.classList.remove('hidden');
    uploadComplete.classList.add('hidden');

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            uploadStatus.textContent = `Caricamento ${i + 1} di ${files.length}: ${file.name}`;
            progressBar.style.width = `${((i / files.length) * 100)}%`;

            await uploadFile(file);
        }

        progressBar.style.width = '100%';
        uploadProgress.classList.add('hidden');
        uploadComplete.classList.remove('hidden');

        // Ricarica la lista dei documenti
        setTimeout(() => {
            uploadModal.classList.add('hidden');
            listDocuments();
            fileInput.value = ''; // Reset input
        }, 2000);
    } catch (error) {
        console.error('Errore upload:', error);
        alert('Errore durante il caricamento del file.');
        uploadModal.classList.add('hidden');
        fileInput.value = '';
    }
});

// Upload di un singolo file
async function uploadFile(file) {
    const metadata = {
        name: file.name,
        mimeType: file.type
    };

    // Se c'è una cartella specifica, imposta il parent
    if (GOOGLE_CONFIG.DRIVE_FOLDER_ID) {
        metadata.parents = [GOOGLE_CONFIG.DRIVE_FOLDER_ID];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
        body: form
    });

    if (!response.ok) {
        throw new Error('Upload fallito');
    }

    return await response.json();
}

// Chiudi modale upload
closeUploadModal.addEventListener('click', () => {
    uploadModal.classList.add('hidden');
    fileInput.value = '';
});

// --- REFRESH ---
refreshBtn.addEventListener('click', listDocuments);
