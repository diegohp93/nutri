import { useEffect, useState } from "react";
import Modal from "./Modal";
import { addDiaryEntry, listRecipes } from "../api/client";
import type { Meal, RecipeSummary } from "../types";

interface Props {
    date: string;
    meal: Meal;
    onClose: () => void;
    onAdded: () => void;
}

export default function RecipeSearchModal({ date, meal, onClose, onAdded }: Props) {
    const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<RecipeSummary | null>(null);
    const [unit, setUnit] = useState<"serving" | "g">("serving");
    const [servings, setServings] = useState(1);
    const [quantity, setQuantity] = useState(100);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        listRecipes()
            .then((r) => setRecipes(r.recipes))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    function handleSelect(r: RecipeSummary) {
        setSelected(r);
        setUnit("serving");
        setServings(1);
        setQuantity(Math.round(r.gramsPerServing));
    }

    const gramsForSelected = selected
        ? unit === "serving"
            ? servings * selected.gramsPerServing
            : quantity
        : 0;

    async function handleConfirm() {
        if (!selected) return;
        setSaving(true);
        try {
            await addDiaryEntry({
                date,
                meal,
                name: selected.name,
                brand: null,
                barcode: null,
                quantityG: gramsForSelected,
                caloriesPer100g: selected.caloriesPer100g,
                proteinPer100g: selected.proteinPer100g,
                carbsPer100g: selected.carbsPer100g,
                fatPer100g: selected.fatPer100g,
            });
            onAdded();
            onClose();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    }

    if (selected) {
        const factor = gramsForSelected / 100;
        return (
            <Modal title={selected.name} onClose={onClose}>
                <div className="unit-toggle">
                    <button
                        type="button"
                        className={`btn ${unit === "serving" ? "primary" : "secondary"}`}
                        onClick={() => setUnit("serving")}
                    >
                        Porzioni
                    </button>
                    <button
                        type="button"
                        className={`btn ${unit === "g" ? "primary" : "secondary"}`}
                        onClick={() => setUnit("g")}
                    >
                        Grammi
                    </button>
                </div>
                {unit === "serving" ? (
                    <label className="field">
                        Numero di porzioni
                        <input type="number" min={0.25} step={0.25} value={servings} onChange={(e) => setServings(Number(e.target.value))} />
                    </label>
                ) : (
                    <label className="field">
                        Quantità (g)
                        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                    </label>
                )}
                <p className="muted small">
                    1 porzione = {Math.round(selected.gramsPerServing)} g · totale {Math.round(gramsForSelected)} g
                </p>
                <div className="macro-preview">
                    <div><strong>{Math.round(selected.caloriesPer100g * factor)}</strong> kcal</div>
                    <div>P: {Math.round(selected.proteinPer100g * factor)} g</div>
                    <div>C: {Math.round(selected.carbsPer100g * factor)} g</div>
                    <div>G: {Math.round(selected.fatPer100g * factor)} g</div>
                </div>
                {error && <p className="error">{error}</p>}
                <div className="modal-actions">
                    <button className="btn secondary" onClick={() => setSelected(null)}>Indietro</button>
                    <button className="btn primary" onClick={handleConfirm} disabled={saving}>
                        {saving ? "Aggiungo…" : "Aggiungi"}
                    </button>
                </div>
            </Modal>
        );
    }

    const filtered = recipes.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()));

    return (
        <Modal title="Usa una ricetta" onClose={onClose}>
            <input
                className="search-input"
                autoFocus
                placeholder="Cerca tra le tue ricette…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {loading && <p className="muted">Caricamento…</p>}
            {error && <p className="error">{error}</p>}
            <ul className="result-list">
                {filtered.map((r) => (
                    <li key={r.id} className="result-item" onClick={() => handleSelect(r)}>
                        <div>
                            <div className="result-name">{r.name}</div>
                            <div className="muted small">
                                {r.servings} {r.servings === 1 ? "porzione" : "porzioni"} · {Math.round(r.gramsPerServing)} g/porzione
                            </div>
                        </div>
                        <div className="result-kcal">{Math.round(r.caloriesPerServing)} kcal/porzione</div>
                    </li>
                ))}
            </ul>
            {!loading && recipes.length === 0 && (
                <p className="muted">Non hai ancora salvato nessuna ricetta. Puoi crearne una dalle Impostazioni.</p>
            )}
            {!loading && recipes.length > 0 && filtered.length === 0 && (
                <p className="muted">Nessuna ricetta corrisponde alla ricerca.</p>
            )}
        </Modal>
    );
}
