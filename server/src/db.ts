import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR permette di puntare a un volume persistente quando il server gira su hosting cloud.
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "nutri.db"));
// journal_mode DELETE (invece di WAL) tiene tutti i dati in un unico file .db:
// con WAL i dati recenti restano per giorni nel file separato .db-wal non ancora
// "unito" al .db principale, e OneDrive sincronizza i due file in modo indipendente
// e non atomico -> rischio di vedere il db "vuoto" se .db arriva sincronizzato senza il suo .db-wal.
db.exec("PRAGMA journal_mode = DELETE;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS diary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    meal TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snack')),
    name TEXT NOT NULL,
    brand TEXT,
    barcode TEXT,
    quantity_g REAL NOT NULL,
    calories REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exercise_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    wger_id INTEGER,
    met REAL,
    duration_min REAL NOT NULL,
    calories_burned REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hidden_food_history (
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (name, brand)
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    servings REAL NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity_g REAL NOT NULL,
    calories_per_100g REAL NOT NULL,
    protein_per_100g REAL NOT NULL,
    carbs_per_100g REAL NOT NULL,
    fat_per_100g REAL NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_diary_date ON diary_entries(date);
  CREATE INDEX IF NOT EXISTS idx_exercise_date ON exercise_entries(date);
  CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
`);

function hasColumn(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

// Step 1 della migrazione multi-utente: aggiunge solo la colonna, senza backfill né
// filtro nelle query (fatto nello step 2) - finché esiste un solo utente non cambia nulla.
for (const table of ["diary_entries", "exercise_entries", "recipes"]) {
  if (!hasColumn(table, "user_id")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id);`);
  }
}

// Migrazione da un database creato prima dell'introduzione dei ruoli (tutti gli utenti erano
// implicitamente amministratori, essendo l'unico utente possibile all'epoca).
if (!hasColumn("users", "is_admin")) {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;");
}

// settings e hidden_food_history avevano una PRIMARY KEY che deve diventare composita
// (includere user_id): SQLite non supporta l'ALTER di una PRIMARY KEY, va ricreata la tabella.
if (!hasColumn("settings", "user_id")) {
  db.exec(`
    ALTER TABLE settings RENAME TO settings_old;
    CREATE TABLE settings (
      user_id INTEGER REFERENCES users(id),
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );
    INSERT INTO settings (user_id, key, value) SELECT NULL, key, value FROM settings_old;
    DROP TABLE settings_old;
  `);
}

if (!hasColumn("hidden_food_history", "user_id")) {
  db.exec(`
    ALTER TABLE hidden_food_history RENAME TO hidden_food_history_old;
    CREATE TABLE hidden_food_history (
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (user_id, name, brand)
    );
    INSERT INTO hidden_food_history (user_id, name, brand) SELECT NULL, name, brand FROM hidden_food_history_old;
    DROP TABLE hidden_food_history_old;
  `);
}

// Step 2: finché esiste un solo utente, tutti i dati storici senza proprietario sono suoi
// per definizione (sono stati creati prima che il login esistesse). Se in futuro esistono
// più utenti, il backfill automatico si ferma per evitare assegnazioni ambigue.
export function backfillOwnerData(): void {
  const users = db.prepare("SELECT id FROM users").all() as { id: number }[];
  if (users.length !== 1) return;
  const ownerId = users[0].id;
  db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(ownerId);
  for (const table of ["diary_entries", "exercise_entries", "recipes", "settings", "hidden_food_history"]) {
    db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(ownerId);
  }
}
backfillOwnerData();

