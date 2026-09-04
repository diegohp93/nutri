// Backup automatico di nutri.db verso OneDrive (percorsi fissi per questa macchina).
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, "..", "data", "nutri.db");
const destDir = "c:\\Users\\DiegoBattistelli\\OneDrive\\Documenti\\Personali\\Nutri\\server\\data";
const destPath = path.join(destDir, "nutri.db");
const tmpPath = destPath + ".tmp";

fs.mkdirSync(destDir, { recursive: true });
fs.rmSync(tmpPath, { force: true });

const db = new DatabaseSync(sourcePath, { readOnly: true });
try {
    // VACUUM INTO produce sempre un unico file consistente, anche con il DB sorgente in WAL.
    db.exec(`VACUUM INTO '${tmpPath.replace(/'/g, "''")}'`);
} finally {
    db.close();
}

fs.renameSync(tmpPath, destPath);
console.log(`[${new Date().toISOString()}] Backup nutri.db completato -> ${destPath}`);
