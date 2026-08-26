import { Router } from "express";
import { db } from "../db.js";

const router = Router();

type IngredientRow = {
    id: number;
    name: string;
    quantity_g: number;
    calories_per_100g: number;
    protein_per_100g: number;
    carbs_per_100g: number;
    fat_per_100g: number;
};

// Aggrega gli ingredienti in valori totali e "per 100g", per poter trattare la ricetta come un alimento unico
function aggregate(ingredients: IngredientRow[], servings: number) {
    const totals = ingredients.reduce(
        (acc, ing) => {
            const factor = ing.quantity_g / 100;
            acc.grams += ing.quantity_g;
            acc.calories += ing.calories_per_100g * factor;
            acc.protein += ing.protein_per_100g * factor;
            acc.carbs += ing.carbs_per_100g * factor;
            acc.fat += ing.fat_per_100g * factor;
            return acc;
        },
        { grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const per100 = (value: number) => (totals.grams > 0 ? Math.round((value / totals.grams) * 100 * 10) / 10 : 0);
    return {
        totalGrams: Math.round(totals.grams * 10) / 10,
        gramsPerServing: servings > 0 ? Math.round((totals.grams / servings) * 10) / 10 : totals.grams,
        caloriesTotal: Math.round(totals.calories * 10) / 10,
        caloriesPerServing: servings > 0 ? Math.round((totals.calories / servings) * 10) / 10 : totals.calories,
        caloriesPer100g: per100(totals.calories),
        proteinPer100g: per100(totals.protein),
        carbsPer100g: per100(totals.carbs),
        fatPer100g: per100(totals.fat),
    };
}

// Elenco ricette salvate con valori nutrizionali aggregati
router.get("/", (_req, res) => {
    const recipes = db.prepare("SELECT * FROM recipes ORDER BY name COLLATE NOCASE").all() as {
        id: number;
        name: string;
        servings: number;
    }[];

    const ingredientStmt = db.prepare("SELECT * FROM recipe_ingredients WHERE recipe_id = ?");
    const result = recipes.map((r) => {
        const ingredients = ingredientStmt.all(r.id) as IngredientRow[];
        return {
            id: r.id,
            name: r.name,
            servings: r.servings,
            ingredientCount: ingredients.length,
            ...aggregate(ingredients, r.servings),
        };
    });

    res.json({ recipes: result });
});

// Dettaglio ricetta con lista ingredienti (per visualizzarla o modificarla)
router.get("/:id", (req, res) => {
    const recipe = db.prepare("SELECT * FROM recipes WHERE id = ?").get(req.params.id) as
        | { id: number; name: string; servings: number }
        | undefined;
    if (!recipe) return res.status(404).json({ error: "Ricetta non trovata" });

    const ingredients = db
        .prepare("SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY id")
        .all(recipe.id) as IngredientRow[];

    res.json({
        recipe: {
            id: recipe.id,
            name: recipe.name,
            servings: recipe.servings,
            ingredients,
            ...aggregate(ingredients, recipe.servings),
        },
    });
});

router.post("/", (req, res) => {
    const { name, servings, ingredients } = req.body ?? {};
    if (!name || !Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({ error: "Servono un nome e almeno un ingrediente" });
    }

    const insertRecipe = db.prepare("INSERT INTO recipes (name, servings) VALUES (@name, @servings)");
    const insertIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (recipe_id, name, quantity_g, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
        VALUES (@recipeId, @name, @quantityG, @caloriesPer100g, @proteinPer100g, @carbsPer100g, @fatPer100g)
    `);

    db.exec("BEGIN");
    try {
        const info = insertRecipe.run({ name, servings: Number(servings) || 1 });
        const recipeId = info.lastInsertRowid;
        for (const ing of ingredients) {
            if (!ing?.name || !ing?.quantityG) continue;
            insertIngredient.run({
                recipeId,
                name: ing.name,
                quantityG: Number(ing.quantityG),
                caloriesPer100g: Number(ing.caloriesPer100g) || 0,
                proteinPer100g: Number(ing.proteinPer100g) || 0,
                carbsPer100g: Number(ing.carbsPer100g) || 0,
                fatPer100g: Number(ing.fatPer100g) || 0,
            });
        }
        db.exec("COMMIT");

        const created = db.prepare("SELECT * FROM recipes WHERE id = ?").get(recipeId);
        res.status(201).json({ recipe: created });
    } catch (err) {
        db.exec("ROLLBACK");
        throw err;
    }
});

router.delete("/:id", (req, res) => {
    db.prepare("DELETE FROM recipes WHERE id = ?").run(req.params.id);
    res.status(204).end();
});

export default router;
