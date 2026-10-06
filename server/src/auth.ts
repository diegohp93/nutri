import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db.js";

declare global {
    namespace Express {
        interface Request {
            user?: { id: number; username: string; isAdmin: boolean };
        }
    }
}

const SESSION_TTL_DAYS = 30;

export function hashPassword(password: string): string {
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64);
    return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [saltHex, hashHex] = stored.split(":");
    if (!saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSession(userId: number): string {
    const token = randomBytes(32).toString("hex");
    db.prepare(
        `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_TTL_DAYS} days'))`
    ).run(token, userId);
    return token;
}

export function getSessionUser(token: string): { id: number; username: string; isAdmin: boolean } | null {
    const row = db
        .prepare(
            `SELECT u.id, u.username, u.is_admin FROM sessions s
             JOIN users u ON u.id = s.user_id
             WHERE s.token = ? AND s.expires_at > datetime('now')`
        )
        .get(token) as { id: number; username: string; is_admin: number } | undefined;
    return row ? { id: row.id, username: row.username, isAdmin: !!row.is_admin } : null;
}

export function deleteSession(token: string): void {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function userCount(): number {
    return (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
}

export function bearerToken(req: { header(name: string): string | undefined }): string | null {
    const header = req.header("authorization") ?? "";
    return header.startsWith("Bearer ") ? header.slice(7) : null;
}

// In locale, finché non esiste nessun utente, le richieste non sono autenticate (vedi index.ts):
// in quel caso i dati restano "globali" (user_id NULL), proprio come prima dell'introduzione del login.
export function userIdOf(req: { user?: { id: number } }): number | null {
    return req.user?.id ?? null;
}
