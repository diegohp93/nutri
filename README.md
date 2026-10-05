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

Per usare l'app anche da telefono con gli stessi dati del desktop, il backend va reso
raggiungibile da internet e installato come PWA sul telefono (icona in home screen,
niente store). Il sito è già pronto per entrambe le cose:

1. **Pubblica il backend** (include anche il frontend, sullo stesso dominio). Serve un
   account gratuito su [Fly.io](https://fly.io/) e la loro CLI (`flyctl`). Dalla root del
   repo:
   ```powershell
   fly launch --no-deploy
   fly secrets set API_TOKEN=scegli-un-codice-segreto
   fly volumes create nutri_data --size 1
   fly deploy
   ```
   `fly launch` legge automaticamente [fly.toml](fly.toml) e il [Dockerfile](Dockerfile) alla
   root, che compilano sia `client/` sia `server/` e li impacchettano in un solo servizio.
   `API_TOKEN` protegge l'app (altrimenti chiunque trovi l'URL può leggere/scrivere i tuoi
   dati): se non lo imposti, il server resta aperto come in locale.
2. **Apri l'URL pubblico** (es. `https://nutri.fly.dev`) dal browser del telefono: al primo
   utilizzo ti verrà chiesto il codice impostato in `API_TOKEN`, dopo resta salvato.
3. **Aggiungi alla home screen**: su Android/Chrome "Aggiungi a schermata Home", su
   iOS/Safari "Condividi" → "Aggiungi a Home". L'app si apre a schermo intero come
   un'app nativa (PWA) e resta sincronizzata in tempo reale con il desktop, perché
   entrambi parlano con lo stesso backend.
4. **Da desktop**, usa lo stesso URL pubblico anziché l'avvio in locale: così i dati
   restano sempre un'unica copia, sincronizzata con il telefono.

In alternativa a Fly.io puoi hostare lo stesso Dockerfile su qualunque altro servizio
(Render, un VPS, un Raspberry Pi in casa con un tunnel) purché offra un volume/disco
persistente per `server/data`.

## Note tecniche

- Il backend usa il modulo built-in `node:sqlite` (nessuna dipendenza nativa da compilare).
- La ricerca esercizi wger non è supportata nativamente dalla loro API pubblica: il backend mantiene una cache locale (aggiornata ogni 6 ore) dei nomi esercizio in inglese e italiano per poter fare una ricerca testuale.
- Le calorie/macro dei prodotti Open Food Facts sono espresse per 100 g; l'app calcola i valori in base alla quantità inserita.

