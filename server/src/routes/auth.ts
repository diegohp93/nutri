import { Router } from "express";
import { db } from "../db.js";
import { bearerToken, createSession, deleteSession, hashPassword, userCount, verifyPassword } from "../auth.js";

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
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hashPassword(password));
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

export default router;
