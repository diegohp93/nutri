import { Router } from "express";
import { db } from "../db.js";
import { MET_BY_CATEGORY, estimateCalories } from "../met.js";

const router = Router();
const WGER_BASE = "https://wger.de/api/v2";
const ENGLISH_LANGUAGE_ID = 2;
const ITALIAN_LANGUAGE_ID = 13;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 ore

type CachedExercise = { wgerId: number; name: string; category: string; met: number; searchText: string };

let exerciseCache: CachedExercise[] = [];
let cacheBuiltAt = 0;
let cacheBuildingPromise: Promise<void> | null = null;

async function fetchAllPages<T>(path: string): Promise<T[]> {
    const results: T[] = [];
    let url: string | null = `${WGER_BASE}${path}${path.includes("?") ? "&" : "?"}limit=500&format=json`;
    while (url) {
        const r: Response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error(`wger ha risposto ${r.status} su ${url}`);
        const data: { results: T[]; next: string | null } = await r.json();
        results.push(...data.results);
        url = data.next;
    }
    return results;
}

// La ricerca testuale nativa di wger non funziona più (endpoint rimosso, filtri "name"/"search"
// ignorati dall'API), quindi costruiamo una cache locale con nomi in inglese (copertura completa)
// e italiano (copertura parziale) per esercizio, e filtriamo noi lato server.
async function buildExerciseCache(): Promise<void> {
    const [categories, exercises, translations] = await Promise.all([
        fetchAllPages<{ id: number; name: string }>("/exercisecategory/"),
        fetchAllPages<{ id: number; category: number }>("/exercise/"),
        fetchAllPages<{ exercise: number; name: string; language: number }>("/exercise-translation/"),
    ]);

    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const categoryIdByExerciseId = new Map(exercises.map((e) => [e.id, e.category]));

    const enNameByExercise = new Map<number, string>();
    const itNameByExercise = new Map<number, string>();
    for (const t of translations) {
        if (!t.name) continue;
        if (t.language === ENGLISH_LANGUAGE_ID) enNameByExercise.set(t.exercise, t.name);
        else if (t.language === ITALIAN_LANGUAGE_ID) itNameByExercise.set(t.exercise, t.name);
    }

    exerciseCache = Array.from(enNameByExercise.entries()).map(([exerciseId, enName]) => {
        const itName = itNameByExercise.get(exerciseId);
        const categoryId = categoryIdByExerciseId.get(exerciseId);
        const category = (categoryId !== undefined && categoryNameById.get(categoryId)) || "Default";
        return {
            wgerId: exerciseId,
            name: itName || enName,
            category,
            met: MET_BY_CATEGORY[category] ?? MET_BY_CATEGORY.Default,
            searchText: `${enName} ${itName ?? ""}`.toLowerCase(),
        };
    });

    cacheBuiltAt = Date.now();
}

async function ensureCache(): Promise<void> {
    if (exerciseCache.length > 0 && Date.now() - cacheBuiltAt < CACHE_TTL_MS) return;
    if (!cacheBuildingPromise) {
        cacheBuildingPromise = buildExerciseCache().finally(() => {
            cacheBuildingPromise = null;
        });
    }
    await cacheBuildingPromise;
}

// Ricerca esercizi nel database open source di wger (con cache locale, l'API non supporta ricerca testuale)
router.get("/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim().toLowerCase();
    if (!q) return res.json({ exercises: [] });

    try {
        await ensureCache();
        const matches = exerciseCache
            .filter((e) => e.searchText.includes(q))
            .sort((a, b) => a.name.length - b.name.length)
            .slice(0, 20)
            .map(({ wgerId, name, category, met }) => ({ wgerId, name, category, met }));
        res.json({ exercises: matches });
    } catch (err) {
        console.error("Errore ricerca wger:", err);
        res.status(502).json({ error: "Impossibile contattare il database wger", exercises: [] });
    }
});


// Log giornaliero attività: aggiunta
router.post("/log", (req, res) => {
    const { date, name, category, wgerId, met, durationMin, caloriesOverride } = req.body ?? {};
    if (!date || !name || !durationMin) {
        return res.status(400).json({ error: "Campi obbligatori mancanti (date, name, durationMin)" });
    }

    const weightRow = db.prepare("SELECT value FROM settings WHERE key = 'body_weight_kg'").get() as
        | { value: string }
        | undefined;
    const weightKg = weightRow ? Number(weightRow.value) : 70;

    const finalMet = typeof met === "number" ? met : MET_BY_CATEGORY.Default;
    const caloriesBurned =
        typeof caloriesOverride === "number"
            ? caloriesOverride
            : estimateCalories(finalMet, weightKg, Number(durationMin));

    const stmt = db.prepare(`
    INSERT INTO exercise_entries (date, name, category, wger_id, met, duration_min, calories_burned)
    VALUES (@date, @name, @category, @wgerId, @met, @durationMin, @caloriesBurned)
  `);
    const info = stmt.run({
        date,
        name,
        category: category ?? null,
        wgerId: wgerId ?? null,
        met: finalMet,
        durationMin: Number(durationMin),
        caloriesBurned,
    });

    const created = db.prepare("SELECT * FROM exercise_entries WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ entry: created });
});

router.delete("/log/:id", (req, res) => {
    db.prepare("DELETE FROM exercise_entries WHERE id = ?").run(req.params.id);
    res.status(204).end();
});

export default router;
