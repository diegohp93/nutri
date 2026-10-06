import { Router } from "express";
import { db, backfillOwnerData } from "../db.js";
import { bearerToken, createSession, deleteSession, getSessionUser, hashPassword, userCount, verifyPassword } from "../auth.js";

const router = Router();

// Crea il primo utente (es. l'admin). Protetto da SETUP_TOKEN e disabilitato non appena
// esiste già un utente: serve solo per il bootstrap iniziale, anche da remoto (es. Render).
router.post("/setup", (req, res) => {
    const setupToken = process.env.SETUP_TOKEN;
    if (!setupToken) {
        res.status(404).json({ error: "Non disponibile" });
        return;
    }
    if (bearerToken(req) !== setupToken) {
        res.status(401).json({ error: "Non autorizzato" });
        return;
    }
    if (userCount() > 0) {
        res.status(403).json({ error: "Configurazione già completata" });
        return;
    }
    const { username, password } = req.body ?? {};
    if (!username || !password) {
        res.status(400).json({ error: "Username e password richiesti" });
        return;
    }
    db.prepare("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)").run(username, hashPassword(password));
    backfillOwnerData();
    res.json({ ok: true });
});

router.post("/login", (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
        res.status(400).json({ error: "Username e password richiesti" });
        return;
    }
    const user = db.prepare("SELECT id, password_hash FROM users WHERE username = ?").get(username) as
        | { id: number; password_hash: string }
        | undefined;
    if (!user || !verifyPassword(password, user.password_hash)) {
        res.status(401).json({ error: "Credenziali non valide" });
        return;
    }
    res.json({ token: createSession(user.id) });
});

router.post("/logout", (req, res) => {
    const token = bearerToken(req);
    if (token) deleteSession(token);
    res.json({ ok: true });
});

// Crea altri utenti (es. account beta): richiede di essere già loggati come amministratore,
// dato che /setup funziona solo finché il database è ancora vuoto.
router.post("/users", (req, res) => {
    const caller = getSessionUser(bearerToken(req) ?? "");
    if (!caller?.isAdmin) {
        res.status(401).json({ error: "Non autorizzato" });
        return;
    }
    const { username, password } = req.body ?? {};
    if (!username || !password) {
        res.status(400).json({ error: "Username e password richiesti" });
        return;
    }
    try {
        db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hashPassword(password));
    } catch {
        res.status(409).json({ error: "Username già in uso" });
        return;
    }
    res.json({ ok: true });
});

// Promuove un utente esistente ad amministratore (es. prima di cancellare l'admin attuale,
// per non restare senza nessuno con questo ruolo).
router.post("/users/:username/promote", (req, res) => {
    const caller = getSessionUser(bearerToken(req) ?? "");
    if (!caller?.isAdmin) {
        res.status(401).json({ error: "Non autorizzato" });
        return;
    }
    const info = db.prepare("UPDATE users SET is_admin = 1 WHERE username = ?").run(req.params.username);
    if (info.changes === 0) {
        res.status(404).json({ error: "Utente non trovato" });
        return;
    }
    res.json({ ok: true });
});

// Cancella un utente e tutti i suoi dati. Non è possibile cancellare l'ultimo admin rimasto
// (anche se coincide con chi sta chiamando), per non restare senza nessuno che possa gestire gli account.
router.delete("/users/:username", (req, res) => {
    const caller = getSessionUser(bearerToken(req) ?? "");
    if (!caller?.isAdmin) {
        res.status(401).json({ error: "Non autorizzato" });
        return;
    }
    const target = db.prepare("SELECT id, is_admin FROM users WHERE username = ?").get(req.params.username) as
        | { id: number; is_admin: number }
        | undefined;
    if (!target) {
        res.status(404).json({ error: "Utente non trovato" });
        return;
    }
    if (target.is_admin) {
        const adminCount = (db.prepare("SELECT COUNT(*) AS c FROM users WHERE is_admin = 1").get() as { c: number }).c;
        if (adminCount <= 1) {
            res.status(409).json({ error: "Non puoi cancellare l'unico amministratore rimasto" });
            return;
        }
    }
    db.exec("BEGIN");
    try {
        for (const table of ["diary_entries", "exercise_entries", "recipes", "settings", "hidden_food_history"]) {
            db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(target.id);
        }
        db.prepare("DELETE FROM users WHERE id = ?").run(target.id);
        db.exec("COMMIT");
    } catch (err) {
        db.exec("ROLLBACK");
        throw err;
    }
    res.json({ ok: true });
});

export default router;
