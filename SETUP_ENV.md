# 🔐 Setup Variabili d'Ambiente

Questo progetto usa variabili d'ambiente per proteggere le configurazioni sensibili di Firebase e Google API.

## 📋 Configurazione su Vercel

### 1. Accedi al tuo progetto su Vercel
Vai su [vercel.com](https://vercel.com) e apri il progetto `studio-kraken-gate`

### 2. Vai nelle Settings
- Clicca su **Settings** (nel menu in alto)
- Nella sidebar, clicca su **Environment Variables**

### 3. Aggiungi le seguenti variabili

Clicca su **Add New** per ogni variabile:

#### Firebase Configuration
| Nome | Valore | Ambiente |
|------|--------|----------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyBtQZkX6r4F2W0BsIo6nsD27dUZHv3e8RU` | Production, Preview, Development |
| `VITE_FIREBASE_AUTH_DOMAIN` | `studio-kraken-gate.firebaseapp.com` | Production, Preview, Development |
| `VITE_FIREBASE_PROJECT_ID` | `studio-kraken-gate` | Production, Preview, Development |
| `VITE_FIREBASE_STORAGE_BUCKET` | `studio-kraken-gate.firebasestorage.app` | Production, Preview, Development |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `744360512833` | Production, Preview, Development |
| `VITE_FIREBASE_APP_ID` | `1:744360512833:web:ed0952f304c37bd5ee25c0` | Production, Preview, Development |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-39RLC549LJ` | Production, Preview, Development |
| `VITE_FIREBASE_DATABASE_URL` | `https://studio-kraken-gate-default-rtdb.firebaseio.com` | Production, Preview, Development |

#### Google API Configuration
| Nome | Valore | Ambiente |
|------|--------|----------|
| `VITE_GOOGLE_CLIENT_ID` | `637673514104-747b0d7vsiev6e4rbvlfk8jfps1ttutb.apps.googleusercontent.com` | Production, Preview, Development |

### 4. Seleziona gli ambienti
Per ogni variabile, seleziona tutti e tre gli ambienti:
- ✅ Production
- ✅ Preview
- ✅ Development

### 5. Salva e Rideploya
Dopo aver aggiunto tutte le variabili:
1. Clicca **Save** per ogni variabile
2. Vai nella tab **Deployments**
3. Clicca sui tre puntini dell'ultimo deployment
4. Clicca **Redeploy**

---

## 💻 Sviluppo Locale

### 1. Crea un file `.env` nella cartella `Gestionale Studio`
```bash
cd "StudioKrakenGate-main/Gestionale Studio"
cp .env.example .env
```

### 2. Modifica il file `.env` con i tuoi valori
Apri il file `.env` e inserisci le tue credenziali (stesso formato di `.env.example`)

### 3. Il file `.env` è protetto
Il file `.env` è già nel `.gitignore` e **non verrà mai committato** su Git.

---

## 🔍 Come Funziona

### Durante il Build su Vercel:
1. Vercel legge le variabili d'ambiente dal suo pannello
2. Esegue lo script `build-env.js` che inietta le variabili negli HTML
3. Le variabili vengono rese disponibili come `window.__ENV__`
4. I file `firebase-config.js` e `google-calendar-config.js` leggono da `ENV`

### File Coinvolti:
- [env-config.js](StudioKrakenGate-main/Gestionale Studio/js/env-config.js) - Legge le variabili da `window.__ENV__`
- [build-env.js](StudioKrakenGate-main/Gestionale Studio/build-env.js) - Inietta le variabili negli HTML durante il build
- [firebase-config.js](StudioKrakenGate-main/Gestionale Studio/js/firebase-config.js) - Usa `ENV` invece di valori hardcoded
- [google-calendar-config.js](StudioKrakenGate-main/Gestionale Studio/js/google-calendar-config.js) - Usa `ENV` invece di valori hardcoded

---

## ✅ Verifica che Funzioni

Dopo il deploy:
1. Apri il sito: https://studio-kraken-gate.vercel.app
2. Apri DevTools (F12)
3. Nella Console, scrivi: `window.__ENV__`
4. Dovresti vedere tutte le variabili configurate
5. Prova a fare login e usare Calendar/Drive

---

## 🛡️ Sicurezza

### Cosa è protetto:
- ✅ Le configurazioni non sono più hardcoded nel codice sorgente
- ✅ Il file `.env` locale non viene committato
- ✅ Le variabili sono visibili solo a runtime (non nel codice statico)

### Nota importante:
Le variabili d'ambiente client-side (che iniziano con `VITE_`) **sono visibili nel browser** perché il codice è client-side JavaScript. Questo è normale e accettabile per:
- Firebase API Key (progettata per essere pubblica, protetta da Firebase Security Rules)
- Google CLIENT_ID (progettata per essere pubblica, protetta da Authorized Domains)

La vera sicurezza sta in:
1. **Firebase Security Rules** - Proteggono i dati nel database
2. **Google API Authorized Domains** - Solo il tuo dominio può usare il CLIENT_ID
3. **Firebase Authentication** - Solo utenti autenticati possono accedere ai dati

---

## 🚨 Troubleshooting

### Errore: "Variabili d'ambiente mancanti"
- Verifica di aver aggiunto tutte le variabili su Vercel
- Controlla che i nomi siano scritti correttamente (case-sensitive)
- Rideploya il progetto dopo aver aggiunto le variabili

### Il sito non si carica / Errori Firebase
- Apri DevTools Console
- Controlla se `window.__ENV__` esiste e contiene le variabili
- Verifica che i valori delle variabili siano corretti

### In locale non funziona
- Assicurati di aver creato il file `.env` nella cartella `Gestionale Studio`
- Verifica che il file `.env` contenga tutte le variabili necessarie
