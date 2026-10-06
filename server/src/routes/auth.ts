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

export default router;
