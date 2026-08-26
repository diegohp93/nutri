import { Router } from "express";
import { db } from "../db.js";

const router = Router();
const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

router.post("/", (req, res) => {
    const {
        date,
        meal,
        name,
        brand,
        barcode,
        quantityG,
        caloriesPer100g,
        proteinPer100g,
        carbsPer100g,
        fatPer100g,
    } = req.body ?? {};

    if (!date || !meal || !name || !quantityG) {
        return res.status(400).json({ error: "Campi obbligatori mancanti (date, meal, name, quantityG)" });
    }
    if (!MEALS.includes(meal)) {
        return res.status(400).json({ error: "Pasto non valido" });
    }

    const factor = Number(quantityG) / 100;
    const calories = Math.round((Number(caloriesPer100g) || 0) * factor * 10) / 10;
    const protein = Math.round((Number(proteinPer100g) || 0) * factor * 10) / 10;
    const carbs = Math.round((Number(carbsPer100g) || 0) * factor * 10) / 10;
    const fat = Math.round((Number(fatPer100g) || 0) * factor * 10) / 10;

    const stmt = db.prepare(`
    INSERT INTO diary_entries (date, meal, name, brand, barcode, quantity_g, calories, protein, carbs, fat)
    VALUES (@date, @meal, @name, @brand, @barcode, @quantityG, @calories, @protein, @carbs, @fat)
  `);
    const info = stmt.run({
        date,
        meal,
        name,
        brand: brand ?? null,
        barcode: barcode ?? null,
        quantityG: Number(quantityG),
        calories,
        protein,
        carbs,
        fat,
    });

    const created = db.prepare("SELECT * FROM diary_entries WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ entry: created });
});

router.delete("/:id", (req, res) => {
    db.prepare("DELETE FROM diary_entries WHERE id = ?").run(req.params.id);
    res.status(204).end();
});

// Modifica la quantità di una voce già inserita, riscalando calorie e macro proporzionalmente
router.put("/:id", (req, res) => {
    const { quantityG } = req.body ?? {};
    if (!quantityG || Number(quantityG) <= 0) {
        return res.status(400).json({ error: "Quantità non valida" });
    }

    const existing = db.prepare("SELECT * FROM diary_entries WHERE id = ?").get(req.params.id) as
        | { quantity_g: number; calories: number; protein: number; carbs: number; fat: number }
        | undefined;
    if (!existing) return res.status(404).json({ error: "Voce non trovata" });

    const ratio = Number(quantityG) / existing.quantity_g;
    const calories = Math.round(existing.calories * ratio * 10) / 10;
    const protein = Math.round(existing.protein * ratio * 10) / 10;
    const carbs = Math.round(existing.carbs * ratio * 10) / 10;
    const fat = Math.round(existing.fat * ratio * 10) / 10;

    db.prepare(
        "UPDATE diary_entries SET quantity_g = ?, calories = ?, protein = ?, carbs = ?, fat = ? WHERE id = ?"
    ).run(Number(quantityG), calories, protein, carbs, fat, req.params.id);

    const updated = db.prepare("SELECT * FROM diary_entries WHERE id = ?").get(req.params.id);
    res.json({ entry: updated });
});

export default router;
