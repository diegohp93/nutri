import { Router } from "express";
import { db } from "../db.js";
import { userIdOf } from "../auth.js";

const router = Router();

const OFF_HEADERS = {
    "User-Agent": "NutriTrackerApp-Personal/1.0 (uso personale, non commerciale)",
};

type OffNutriments = {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
};

type OffProduct = {
    code?: string;
    product_name?: string;
    brands?: string | string[];
    quantity?: string;
    serving_size?: string;
    serving_quantity?: number | string;
    countries_tags?: string[];
    nutriments?: OffNutriments;
};

function cleanText(s: string | undefined | null): string | null {
    if (!s) return null;
    const cleaned = s.replace(/\s+/g, " ").trim();
    return cleaned || null;
}

function firstBrand(brands: string | string[] | undefined): string | null {
    if (Array.isArray(brands)) return cleanText(brands[0]);
    return cleanText(brands?.split(",")[0]);
}

// Estrae una marca incorporata nel nome come "Nome (Marca)" quando non c'è già una colonna brand.
function splitEmbeddedBrand(name: string, brand: string | null): { name: string; brand: string | null } {
    if (brand) return { name, brand };
    const match = name.match(/^(.+)\s\(([^()]+)\)$/);
    return match ? { name: match[1].trim(), brand: match[2].trim() } : { name, brand };
}

function normalizeProduct(p: OffProduct) {
    const n = p.nutriments ?? {};
    const servingQuantityG = p.serving_quantity ? Number(p.serving_quantity) : null;
    return {
        code: p.code ?? null,
        name: cleanText(p.product_name) || "Prodotto senza nome",
        brand: firstBrand(p.brands),
        quantity: cleanText(p.quantity),
        servingSize: cleanText(p.serving_size),
        servingQuantityG: servingQuantityG && servingQuantityG > 0 ? servingQuantityG : null,
        caloriesPer100g: n["energy-kcal_100g"] ?? 0,
        proteinPer100g: n.proteins_100g ?? 0,
        carbsPer100g: n.carbohydrates_100g ?? 0,
        fatPer100g: n.fat_100g ?? 0,
    };
}

// Cerca tra i cibi già inseriti in passato dall'utente e gli ingredienti delle ricette:
// vengono proposti prima dei risultati di Open Food Facts perché già noti/verificati dall'utente.
router.get("/history", (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json({ products: [] });

    const userId = userIdOf(req);
    const rows = db
        .prepare(`
                        SELECT d.name, d.brand, d.barcode, d.quantity_g, d.calories, d.protein, d.carbs, d.fat,
                            d.id AS source_id,
                            (
                                SELECT first_entry.quantity_g
                                FROM diary_entries AS first_entry
                                WHERE first_entry.name = d.name COLLATE NOCASE
                                    AND first_entry.brand IS d.brand
                                    AND first_entry.user_id IS d.user_id
                                ORDER BY first_entry.id
                                LIMIT 1
                            ) AS first_quantity_g
                        FROM diary_entries AS d
                        WHERE d.name LIKE ? COLLATE NOCASE
                            AND d.user_id IS ?
                            AND NOT EXISTS (
                                SELECT 1 FROM hidden_food_history AS h
                                WHERE h.name = d.name COLLATE NOCASE
                                    AND h.brand = COALESCE(d.brand, '') COLLATE NOCASE
                                    AND h.user_id IS d.user_id
                            )
                        UNION ALL
                        SELECT ri.name, NULL AS brand, NULL AS barcode, ri.quantity_g,
                            ri.calories_per_100g * ri.quantity_g / 100 AS calories,
                            ri.protein_per_100g * ri.quantity_g / 100 AS protein,
                            ri.carbs_per_100g * ri.quantity_g / 100 AS carbs,
                            ri.fat_per_100g * ri.quantity_g / 100 AS fat,
                            ri.id AS source_id,
                            ri.quantity_g AS first_quantity_g
                        FROM recipe_ingredients AS ri
                        JOIN recipes AS r ON r.id = ri.recipe_id
                        WHERE ri.name LIKE ? COLLATE NOCASE
                            AND r.user_id IS ?
                            AND NOT EXISTS (
                                SELECT 1 FROM hidden_food_history AS h
                                WHERE h.name = ri.name COLLATE NOCASE
                                    AND h.brand = ''
                                    AND h.user_id IS r.user_id
                            )
                        ORDER BY source_id DESC
                `)
        .all(`%${q}%`, userId, `%${q}%`, userId) as {
            name: string;
            brand: string | null;
            barcode: string | null;
            quantity_g: number;
            calories: number;
            protein: number;
            carbs: number;
            fat: number;
            source_id: number;
            first_quantity_g: number | null;
        }[];

    const byKey = new Map<
        string,
        ReturnType<typeof normalizeProduct> & { source: "history"; usageCount: number }
    >();
    for (const row of rows) {
        // Gli ingredienti di ricetta non hanno una colonna brand: la marca viene salvata nel nome
        // come "Nome (Marca)" (vedi AddIngredientModal). La separiamo qui per unificarli con le
        // voci del diario (stesso prodotto, stesso nome/marca) invece di mostrarli come doppioni.
        const { name, brand } = splitEmbeddedBrand(row.name, row.brand);
        const key = `${name.toLowerCase()}|${(brand ?? "").toLowerCase()}`;
        const existing = byKey.get(key);
        if (existing) {
            existing.usageCount += 1;
            continue;
        }
        const factor = row.quantity_g > 0 ? 100 / row.quantity_g : 0;
        byKey.set(key, {
            code: row.barcode,
            name,
            brand,
            quantity: null,
            servingSize: null,
            servingQuantityG: row.first_quantity_g && row.first_quantity_g > 0 ? row.first_quantity_g : null,
            caloriesPer100g: Math.round(row.calories * factor * 10) / 10,
            proteinPer100g: Math.round(row.protein * factor * 10) / 10,
            carbsPer100g: Math.round(row.carbs * factor * 10) / 10,
            fatPer100g: Math.round(row.fat * factor * 10) / 10,
            source: "history",
            usageCount: 1,
        });
    }

    const products = Array.from(byKey.values())
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 15);
    res.json({ products });
});

router.delete("/history", (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    const brand = String(req.body?.brand ?? "").trim();
    if (!name) return res.status(400).json({ error: "Nome alimento obbligatorio" });

    const userId = userIdOf(req);
    const exists = db
        .prepare("SELECT 1 FROM hidden_food_history WHERE user_id IS ? AND name = ? AND brand = ?")
        .get(userId, name, brand);
    if (!exists) {
        db.prepare("INSERT INTO hidden_food_history (user_id, name, brand) VALUES (?, ?, ?)").run(userId, name, brand);
    }
    res.status(204).end();
});

// Ricerca testuale prodotti su Open Food Facts.
// Usa search-a-licious (search.openfoodfacts.org): il vecchio cgi/search.pl è deprecato e risponde spesso 503.
router.get("/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ products: [] });

    try {
        const url = new URL("https://search.openfoodfacts.org/search");
        url.searchParams.set("q", q);
        url.searchParams.set("page_size", "30");
        url.searchParams.set(
            "fields",
            "code,product_name,brands,quantity,serving_size,serving_quantity,countries_tags,nutriments"
        );

        const r = await fetch(url, { headers: OFF_HEADERS });
        if (!r.ok) throw new Error(`Open Food Facts ha risposto ${r.status}`);
        const data = (await r.json()) as { hits?: OffProduct[] };
        const hits = (data.hits ?? []).filter((p) => p.product_name);

        // A parità di rilevanza, diamo priorità (sort stabile) a:
        // 1. prodotti la cui marca corrisponde a una parola della ricerca (es. "yogurt greco conad" -> marca "Conad")
        // 2. prodotti venduti in Italia
        const queryWords = q.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
        const brandMatchesQuery = (p: OffProduct) => {
            const brandText = (Array.isArray(p.brands) ? p.brands.join(" ") : p.brands ?? "").toLowerCase();
            return queryWords.some((w) => brandText.includes(w));
        };
        const isItalian = (p: OffProduct) => p.countries_tags?.includes("en:italy") ?? false;
        const score = (p: OffProduct) => (brandMatchesQuery(p) ? 2 : 0) + (isItalian(p) ? 1 : 0);
        hits.sort((a, b) => score(b) - score(a));

        const products = hits.map(normalizeProduct);
        res.json({ products });
    } catch (err) {
        console.error("Errore ricerca Open Food Facts:", err);
        res.status(502).json({ error: "Impossibile contattare Open Food Facts", products: [] });
    }
});

// Ricerca per codice a barre
router.get("/barcode/:code", async (req, res) => {
    const { code } = req.params;
    try {
        const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
            code
        )}.json?fields=code,product_name,brands,quantity,serving_size,serving_quantity,nutriments`;
        const r = await fetch(url, { headers: OFF_HEADERS });
        if (!r.ok) throw new Error(`Open Food Facts ha risposto ${r.status}`);
        const data = (await r.json()) as { status: number; product?: OffProduct };
        if (data.status !== 1 || !data.product) {
            return res.status(404).json({ error: "Prodotto non trovato" });
        }
        res.json({ product: normalizeProduct(data.product) });
    } catch (err) {
        console.error("Errore lookup barcode Open Food Facts:", err);
        res.status(502).json({ error: "Impossibile contattare Open Food Facts" });
    }
});

export default router;
