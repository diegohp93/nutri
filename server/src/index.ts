import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { downloadDb, scheduleUpload, isDriveSyncEnabled } from "./driveSync.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "nutri.db");

async function main() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // Su hosting con filesystem effimero (es. Render free) il db va scaricato da Drive
    // PRIMA che "./db.js" lo apra: per questo le route (che importano db.js) vengono
    // caricate dinamicamente qui sotto, solo dopo l'eventuale download.
    if (isDriveSyncEnabled()) {
        console.log("[driveSync] Sincronizzazione con Google Drive attiva.");
        await downloadDb(dbPath);
    }

    const { default: foodsRouter } = await import("./routes/foods.js");
    const { default: exercisesRouter } = await import("./routes/exercises.js");
    const { default: diaryRouter } = await import("./routes/diary.js");
    const { default: settingsRouter } = await import("./routes/settings.js");
    const { default: dayRouter } = await import("./routes/day.js");
    const { default: recipesRouter } = await import("./routes/recipes.js");
    const { default: authRouter } = await import("./routes/auth.js");
    const { bearerToken, getSessionUser, userCount } = await import("./auth.js");

    app.use(cors());
    app.use(express.json());

    app.get("/api/health", (_req, res) => res.json({ ok: true }));

    if (isDriveSyncEnabled()) {
        // Dopo ogni richiesta che modifica dati, ricarica il database su Drive: necessario
        // perché il filesystem locale viene azzerato ad ogni riavvio su hosting free tier.
        // Montato PRIMA di qualunque router (auth incluso): una volta che una route risponde,
        // i middleware registrati dopo di essa non vengono più eseguiti per quella richiesta.
        app.use("/api", (req, res, next) => {
            if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
                res.on("finish", () => {
                    void scheduleUpload(dbPath);
                });
            }
            next();
        });
    }

    app.use("/api/auth", authRouter);

    // Richiede login solo se esiste già almeno un utente: finché nessuno è stato creato
    // (es. sviluppo locale, prima del /api/auth/setup) l'app resta aperta.
    app.use("/api", (req, res, next) => {
        if (userCount() === 0) {
            next();
            return;
        }
        const user = getSessionUser(bearerToken(req) ?? "");
        if (!user) {
            res.status(401).json({ error: "Non autorizzato" });
            return;
        }
        req.user = user;
        next();
    });

    app.use("/api/foods", foodsRouter);
    app.use("/api/exercises", exercisesRouter);
    app.use("/api/diary", diaryRouter);
    app.use("/api/settings", settingsRouter);
    app.use("/api/day", dayRouter);
    app.use("/api/recipes", recipesRouter);

    // Se presente (deploy in produzione: vedi Dockerfile), serve anche la PWA del client
    // sullo stesso dominio/porta dell'API, evitando CORS e un hosting separato.
    const clientDist = path.join(__dirname, "..", "public");
    if (fs.existsSync(clientDist)) {
        app.use(express.static(clientDist));
        app.get(/^\/(?!api).*/, (_req, res) => {
            res.sendFile(path.join(clientDist, "index.html"));
        });
    }

    app.listen(PORT, () => {
        console.log(`Server Nutri in ascolto su http://localhost:${PORT}`);
    });
}

main().catch((err) => {
    console.error("Errore di avvio del server:", err);
    process.exit(1);
});
