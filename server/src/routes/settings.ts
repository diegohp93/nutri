import { Router } from "express";
import { db } from "../db.js";
import { userIdOf } from "../auth.js";

const router = Router();

router.get("/", (req, res) => {
    const rows = db.prepare("SELECT key, value FROM settings WHERE user_id IS ?").all(userIdOf(req)) as {
        key: string;
        value: string;
    }[];
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json({ settings });
});

router.put("/", (req, res) => {
    const updates = req.body ?? {};
    const userId = userIdOf(req);
    // Upsert manuale invece di ON CONFLICT: con user_id NULL (nessun login, es. sviluppo locale)
    // SQLite non considera NULL=NULL un conflitto di chiave, quindi ON CONFLICT non scatterebbe.
    const existsStmt = db.prepare("SELECT 1 FROM settings WHERE user_id IS ? AND key = ?");
    const updateStmt = db.prepare("UPDATE settings SET value = ? WHERE user_id IS ? AND key = ?");
    const insertStmt = db.prepare("INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)");
    db.exec("BEGIN");
    try {
        for (const [key, value] of Object.entries(updates)) {
            if (existsStmt.get(userId, key)) {
                updateStmt.run(String(value), userId, key);
            } else {
                insertStmt.run(userId, key, String(value));
            }
        }
        db.exec("COMMIT");
    } catch (err) {
        db.exec("ROLLBACK");
        throw err;
    }
    res.json({ ok: true });
});

export default router;
