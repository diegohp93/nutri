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

// Con il backend in locale resta vuoto (il proxy Vite inoltra /api); se il backend
// è hostato altrove (es. per l'uso da mobile), va impostato a build-time nel client.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const TOKEN_KEY = "nutri_api_token";

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
}

// window.prompt() blocca il thread e non è supportato in alcuni contesti (es. WebView
// di una TWA Android, o crawler automatici come PWABuilder/Lighthouse): niente più prompt,
// l'app mostra una schermata di sblocco quando riceve questo errore (vedi App.tsx).
export class AuthRequiredError extends Error {
    constructor() {
        super("Accesso richiesto");
        this.name = "AuthRequiredError";
    }
}

async function doFetch(path: string, options?: RequestInit): Promise<Response> {
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE}/api${path}`, { headers, ...options });
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await doFetch(path, options);
    if (res.status === 401) {
        setToken(null);
        throw new AuthRequiredError();
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Errore richiesta: ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Credenziali non valide");
    }
    const { token } = (await res.json()) as { token: string };
    setToken(token);
}

export async function logout(): Promise<void> {
    await doFetch("/auth/logout", { method: "POST" }).catch(() => { });
    setToken(null);
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

export function removeFoodHistory(name: string, brand: string | null): Promise<void> {
    return request(`/foods/history`, {
        method: "DELETE",
        body: JSON.stringify({ name, brand }),
    });
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

export function updateRecipe(id: number, payload: {
    name: string;
    servings: number;
    ingredients: IngredientInput[];
}): Promise<void> {
    return request(`/recipes/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deleteRecipe(id: number): Promise<void> {
    return request(`/recipes/${id}`, { method: "DELETE" });
}

