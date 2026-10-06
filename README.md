# Nutri

App web personale per tracciare calorie e macronutrienti dei pasti giornalieri (Colazione, Pranzo, Cena, Spuntini) e le attività sportive, usando database aperti e gratuiti:

- **[Open Food Facts](https://world.openfoodfacts.org/)** per la ricerca di cibi e bevande (calorie, proteine, carboidrati, grassi per 100 g).
- **[wger](https://wger.de/)** come database open source di esercizi (nome, categoria muscolare/cardio).

Nessun login: è pensata per un solo utente, con i dati salvati in SQLite. L'uso quotidiano avviene tramite l'app pubblicata (vedi "Uso da mobile" più sotto); l'avvio in locale serve per lo sviluppo.

## Struttura del progetto

```
server/   Backend Node.js + Express + TypeScript (API + SQLite via node:sqlite)
client/   Frontend React + Vite + TypeScript
```

## Avvio in locale

### Requisiti

- [Node.js](https://nodejs.org/) **22.13 o successivo** (incluso npm). Il backend usa `node:sqlite`, che non e' disponibile nelle versioni precedenti di Node.
- Connessione Internet solo per cercare alimenti ed esercizi; diario, ricette e impostazioni restano salvati nel database locale di ogni utente.

Verifica l'installazione da PowerShell:

```powershell
node --version
npm --version
```

Se `node` non viene riconosciuto dopo l'installazione, chiudi e riapri il terminale oppure riavvia Windows.

### Avvio manuale (per sviluppo)

Servono due terminali (backend e frontend).

**Terminale 1 — Backend** (porta 4000):
```powershell
cd server
npm ci
npm run dev
```

**Terminale 2 — Frontend** (porta 5173):
```powershell
cd client
npm ci
npm run dev
```

Apri poi [http://localhost:5173](http://localhost:5173). Il frontend inoltra automaticamente le chiamate `/api/*` al backend (proxy configurato in `client/vite.config.ts`).

## Dati e impostazioni

- Il database SQLite viene creato automaticamente in `server/data/nutri.db` al primo avvio.
- Dall'icona ⚙️ in alto puoi impostare il tuo peso corporeo, usato per stimare le calorie bruciate nelle attività sportive (formula MET × peso × ore).
- Le calorie bruciate stimate sono sempre modificabili manualmente prima di salvare un'attività.

## Uso da mobile (sincronizzato con il desktop)

L'app è pubblicata su **Render.com** (hosting gratuito, nessuna carta di credito richiesta)
e installata come PWA sul telefono (icona in home screen, niente store). I dati vivono
su un file di **Google Drive**, letto e scritto dal backend tramite un Service Account:
questo perché il piano gratuito di Render ha un filesystem effimero (si svuota ad ogni
riavvio), quindi il database SQLite non può restare sul disco del server.

**URL pubblico:** https://nutri-u90f.onrender.com

### Come funziona (vedi [server/src/driveSync.ts](server/src/driveSync.ts))

1. All'avvio del processo, il server scarica `nutri.db` da Google Drive (file identificato da
   `DRIVE_FILE_ID`) nella cartella temporanea `DATA_DIR` (`/tmp/data` su Render).
2. Da lì in poi funziona esattamente come in locale: stesso `node:sqlite`, stesse query,
   nessuna modifica al codice delle route.
3. Dopo ogni richiesta che modifica dati (POST/PUT/DELETE/PATCH su `/api/*`), il file
   aggiornato viene ricaricato su Drive.
4. Il piano Free di Render addormenta il servizio dopo 15 minuti di inattività: al
   risveglio (circa un minuto) il server riscarica l'ultima versione da Drive.

### Variabili d'ambiente richieste su Render

| Variabile | Valore |
|---|---|
| `API_TOKEN` | Codice di accesso a scelta (protegge l'app, richiesto al primo utilizzo) |
| `DATA_DIR` | `/tmp/data` |
| `DRIVE_FILE_ID` | ID del file Google Drive che contiene `nutri.db` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Contenuto completo del file JSON della chiave del Service Account Google (Drive API abilitata, con accesso Editor al file sopra) |

### Setup da zero (account Google Cloud + Render)

1. **Google Cloud**: crea un progetto gratuito su https://console.cloud.google.com/, abilita
   "Google Drive API", crea un **Account di servizio** e scaricane la chiave in formato JSON.
2. **Google Drive**: crea un file (anche vuoto) su https://drive.google.com, copiane l'ID
   dall'URL, e condividilo con l'email del Service Account (campo `client_email` nel JSON)
   con permesso **Editor**.
3. **Render**: registrati su https://dashboard.render.com (gratis, con GitHub), crea un
   **Web Service** collegato a questo repo (Render rileva automaticamente il [Dockerfile](Dockerfile)
   alla root, che compila sia `client/` sia `server/`), piano **Free**, e imposta le 4
   variabili d'ambiente della tabella sopra.
4. **Da desktop**, usa lo stesso URL pubblico anziché l'avvio in locale: così i dati
   restano sempre un'unica copia, sincronizzata con il telefono.

### Installazione sul telefono

- **PWA (consigliata, Android e iOS)**: apri l'URL pubblico dal browser del telefono,
  inserisci il codice di `API_TOKEN` quando richiesto, poi su Android/Chrome "Aggiungi a
  schermata Home", su iOS/Safari "Condividi" → "Aggiungi a Home". L'app si apre a schermo
  intero come un'app nativa.
- **APK Android (opzionale)**: generabile gratis con https://www.pwabuilder.com/ incollando
  l'URL pubblico (genera un pacchetto TWA installabile via sideload, senza Play Store). Il
  file [client/public/.well-known/assetlinks.json](client/public/.well-known/assetlinks.json)
  è già configurato per collegare l'app al dominio (nessuna barra URL quando installata).

### Aggiornare manualmente il database su Drive

Se devi ripristinare un backup o sostituire il database: su Google Drive, apri il file →
**Gestisci versioni** → **Carica nuova versione** (mantiene lo stesso ID file, quindi
`DRIVE_FILE_ID` non cambia). Poi riavvia il servizio su Render (Manual Deploy, oppure
aspetta che si riaddormenti e risvegli da solo) perché il download avviene solo all'avvio.

## Ambiente di test

Per provare nuove feature senza rischiare i dati di produzione, esiste un secondo Web
Service Render (free), collegato al branch `test` di questo repo:

- **URL:** https://nutri-test.onrender.com
- **Database:** file separato su Google Drive (stesse env vars di prod tranne
  `DRIVE_FILE_ID`, che punta a una copia indipendente di `nutri.db`).

Flusso di lavoro consigliato:

1. Sviluppa (direttamente su `test`, o su un branch feature staccato da `test`).
2. Push su `test` → auto-deploy su `nutri-test.onrender.com`, verifica che tutto funzioni.
3. Se ok, merge `test` → `main` → auto-deploy su produzione.

## Note tecniche

- Il backend usa il modulo built-in `node:sqlite` (nessuna dipendenza nativa da compilare).
- La ricerca esercizi wger non è supportata nativamente dalla loro API pubblica: il backend mantiene una cache locale (aggiornata ogni 6 ore) dei nomi esercizio in inglese e italiano per poter fare una ricerca testuale.
- Le calorie/macro dei prodotti Open Food Facts sono espresse per 100 g; l'app calcola i valori in base alla quantità inserita.

