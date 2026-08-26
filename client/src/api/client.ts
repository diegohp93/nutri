import type {
    DayResponse,
    DiaryEntry,
    ExerciseEntry,
    ExerciseSearchResult,
    FoodProduct,
    IngredientInput,
    Meal,
    RecipeDetail,
    RecipeSummary,
} from "../types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`/api${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Errore richiesta: ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

export function getDay(date: string): Promise<DayResponse> {
    return request(`/day?date=${date}`);
}

export function searchFoods(q: string): Promise<{ products: FoodProduct[] }> {
    return request(`/foods/search?q=${encodeURIComponent(q)}`);
}

export function searchFoodHistory(q: string): Promise<{ products: FoodProduct[] }> {
    return request(`/foods/history?q=${encodeURIComponent(q)}`);
}

export function getFoodByBarcode(code: string): Promise<{ product: FoodProduct }> {
    return request(`/foods/barcode/${encodeURIComponent(code)}`);
}

export function addDiaryEntry(payload: {
    date: string;
    meal: Meal;
    name: string;
    brand?: string | null;
    barcode?: string | null;
    quantityG: number;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
}): Promise<{ entry: DiaryEntry }> {
    return request(`/diary`, { method: "POST", body: JSON.stringify(payload) });
}

export function deleteDiaryEntry(id: number): Promise<void> {
    return request(`/diary/${id}`, { method: "DELETE" });
}

export function updateDiaryEntryQuantity(id: number, quantityG: number): Promise<{ entry: DiaryEntry }> {
    return request(`/diary/${id}`, { method: "PUT", body: JSON.stringify({ quantityG }) });
}

export function searchExercises(q: string): Promise<{ exercises: ExerciseSearchResult[] }> {
    return request(`/exercises/search?q=${encodeURIComponent(q)}`);
}

export function addExerciseLog(payload: {
    date: string;
    name: string;
    category?: string | null;
    wgerId?: number | null;
    met?: number;
    durationMin: number;
    caloriesOverride?: number;
}): Promise<{ entry: ExerciseEntry }> {
    return request(`/exercises/log`, { method: "POST", body: JSON.stringify(payload) });
}

export function deleteExerciseLog(id: number): Promise<void> {
    return request(`/exercises/log/${id}`, { method: "DELETE" });
}

export function getSettings(): Promise<{ settings: Record<string, string> }> {
    return request(`/settings`);
}

export function updateSettings(payload: Record<string, string | number>): Promise<void> {
    return request(`/settings`, { method: "PUT", body: JSON.stringify(payload) });
}

export function listRecipes(): Promise<{ recipes: RecipeSummary[] }> {
    return request(`/recipes`);
}

export function getRecipe(id: number): Promise<{ recipe: RecipeDetail }> {
    return request(`/recipes/${id}`);
}

export function createRecipe(payload: {
    name: string;
    servings: number;
    ingredients: IngredientInput[];
}): Promise<{ recipe: RecipeSummary }> {
    return request(`/recipes`, { method: "POST", body: JSON.stringify(payload) });
}

export function deleteRecipe(id: number): Promise<void> {
    return request(`/recipes/${id}`, { method: "DELETE" });
}

