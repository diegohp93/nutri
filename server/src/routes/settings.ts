import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", (_req, res) => {
    const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json({ settings });
});

router.put("/", (req, res) => {
    const updates = req.body ?? {};
    const stmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
    db.exec("BEGIN");
    try {
        for (const [key, value] of Object.entries(updates)) {
            stmt.run({ key, value: String(value) });
        }
        db.exec("COMMIT");
    } catch (err) {
        db.exec("ROLLBACK");
        throw err;
    }
    res.json({ ok: true });
});

export default router;
