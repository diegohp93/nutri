# Nutri

App web personale per tracciare calorie e macronutrienti dei pasti giornalieri (Colazione, Pranzo, Cena, Spuntini) e le attività sportive, usando database aperti e gratuiti:

- **[Open Food Facts](https://world.openfoodfacts.org/)** per la ricerca di cibi e bevande (calorie, proteine, carboidrati, grassi per 100 g).
- **[wger](https://wger.de/)** come database open source di esercizi (nome, categoria muscolare/cardio).

Nessun login: è pensata per un solo utente, con i dati salvati in locale (SQLite) sulla tua macchina.

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

### Opzione rapida (Windows)

Fai doppio click su [Avvia-Nutri.bat](Avvia-Nutri.bat): installa le dipendenze al primo avvio se mancanti, apre backend e frontend in due finestre e lancia automaticamente Chrome su [http://localhost:5173](http://localhost:5173). Per chiudere l'app, chiudi le due finestre "Nutri - Backend" e "Nutri - Frontend".

### Opzione manuale

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

## Note tecniche

- Il backend usa il modulo built-in `node:sqlite` (nessuna dipendenza nativa da compilare).
- La ricerca esercizi wger non è supportata nativamente dalla loro API pubblica: il backend mantiene una cache locale (aggiornata ogni 6 ore) dei nomi esercizio in inglese e italiano per poter fare una ricerca testuale.
- Le calorie/macro dei prodotti Open Food Facts sono espresse per 100 g; l'app calcola i valori in base alla quantità inserita.
