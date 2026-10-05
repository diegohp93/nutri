import { JWT } from "google-auth-library";
import fs from "node:fs";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

function getCredentials(): { client_email: string; private_key: string } | null {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;
    return JSON.parse(raw);
}

export function isDriveSyncEnabled(): boolean {
    return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.DRIVE_FILE_ID);
}

async function getAccessToken(): Promise<string> {
    const creds = getCredentials();
    if (!creds) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON non impostata");
    const client = new JWT({ email: creds.client_email, key: creds.private_key, scopes: SCOPES });
    const token = await client.getAccessToken();
    if (!token.token) throw new Error("Impossibile ottenere un access token Google");
    return token.token;
}

// Scarica il database da Google Drive nel percorso locale (no-op se il file su Drive
// non esiste ancora o è vuoto: node:sqlite creerà semplicemente un database nuovo).
export async function downloadDb(localPath: string): Promise<void> {
    const fileId = process.env.DRIVE_FILE_ID;
    if (!fileId) return;
    const token = await getAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) {
        console.log("[driveSync] Nessun database trovato su Drive: ne verrà creato uno nuovo.");
        return;
    }
    if (!res.ok) {
        throw new Error(`Download da Drive fallito: ${res.status} ${await res.text()}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) {
        console.log("[driveSync] File su Drive vuoto: verrà creato un nuovo database locale.");
        return;
    }
    fs.writeFileSync(localPath, buffer);
    console.log(`[driveSync] Database scaricato da Drive (${buffer.length} byte).`);
}

async function uploadDb(localPath: string): Promise<void> {
    const fileId = process.env.DRIVE_FILE_ID;
    if (!fileId || !fs.existsSync(localPath)) return;
    const token = await getAccessToken();
    const buffer = fs.readFileSync(localPath);
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-sqlite3" },
        body: buffer,
    });
    if (!res.ok) {
        throw new Error(`Upload su Drive fallito: ${res.status} ${await res.text()}`);
    }
}

// Le richieste di scrittura serializzano gli upload su questa catena, per evitare che due
// PATCH concorrenti su Drive si sovrappongano quando arrivano richieste ravvicinate.
let uploadChain: Promise<void> = Promise.resolve();
export function scheduleUpload(localPath: string): Promise<void> {
    uploadChain = uploadChain.then(
        () => uploadDb(localPath),
        () => uploadDb(localPath)
    );
    uploadChain = uploadChain.catch((err) => {
        console.error("[driveSync] Errore durante l'upload su Drive:", err);
    });
    return uploadChain;
}
