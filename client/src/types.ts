export type Meal = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_LABELS: Record<Meal, string> = {
    breakfast: "Colazione",
    lunch: "Pranzo",
    dinner: "Cena",
    snack: "Spuntini",
};

export const MEAL_ICONS: Record<Meal, string> = {
    breakfast: "☀️",
    lunch: "🍴",
    dinner: "🌙",
    snack: "🍎",
};

export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

export interface DiaryEntry {
    id: number;
    date: string;
    meal: Meal;
    name: string;
    brand: string | null;
    barcode: string | null;
    quantity_g: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export interface ExerciseEntry {
    id: number;
    date: string;
    name: string;
    category: string | null;
    wger_id: number | null;
    met: number | null;
    duration_min: number;
    calories_burned: number;
}

export interface DayTotals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    caloriesBurned: number;
    caloriesNet: number;
}

export interface DayResponse {
    date: string;
    meals: Record<Meal, DiaryEntry[]>;
    exercises: ExerciseEntry[];
    totals: DayTotals;
}

export interface FoodProduct {
    code: string | null;
    name: string;
    brand: string | null;
    quantity: string | null;
    servingSize: string | null;
    servingQuantityG: number | null;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    source?: "history";
    usageCount?: number;
}

export interface ExerciseSearchResult {
    wgerId: number;
    name: string;
    category: string;
    met: number;
}

export interface IngredientInput {
    name: string;
    quantityG: number;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
}

export interface RecipeIngredient extends IngredientInput {
    id: number;
}

export interface RecipeSummary {
    id: number;
    name: string;
    servings: number;
    ingredientCount: number;
    totalGrams: number;
    gramsPerServing: number;
    caloriesTotal: number;
    caloriesPerServing: number;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
}

export interface RecipeDetail extends RecipeSummary {
    ingredients: RecipeIngredient[];
}
