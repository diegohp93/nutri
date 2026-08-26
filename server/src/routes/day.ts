import { Router } from "express";
import { db } from "../db.js";

const router = Router();

// Vista aggregata di una giornata: pasti raggruppati + attività + totali
router.get("/", (req, res) => {
    const date = String(req.query.date ?? "");
    if (!date) return res.status(400).json({ error: "Parametro 'date' obbligatorio (YYYY-MM-DD)" });

    const foodRows = db
        .prepare("SELECT * FROM diary_entries WHERE date = ? ORDER BY id")
        .all(date) as any[];
    const exerciseRows = db
        .prepare("SELECT * FROM exercise_entries WHERE date = ? ORDER BY id")
        .all(date) as any[];

    const meals: Record<string, any[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const row of foodRows) {
        meals[row.meal]?.push(row);
    }

    const foodTotals = foodRows.reduce(
        (acc, r) => {
            acc.calories += r.calories;
            acc.protein += r.protein;
            acc.carbs += r.carbs;
            acc.fat += r.fat;
            return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const caloriesBurned = exerciseRows.reduce((sum, r) => sum + r.calories_burned, 0);

    res.json({
        date,
        meals,
        exercises: exerciseRows,
        totals: {
            ...foodTotals,
            caloriesBurned: Math.round(caloriesBurned * 10) / 10,
            caloriesNet: Math.round((foodTotals.calories - caloriesBurned) * 10) / 10,
        },
    });
});

export default router;
