import { useState } from "react";
import Modal from "./Modal";
import AddIngredientModal from "./AddIngredientModal";
import { createRecipe } from "../api/client";
import type { IngredientInput } from "../types";

interface Props {
    onClose: () => void;
    onCreated: () => void;
}

export default function RecipeBuilderModal({ onClose, onCreated }: Props) {
    const [name, setName] = useState("");
    const [servings, setServings] = useState(1);
    const [ingredients, setIngredients] = useState<IngredientInput[]>([]);
    const [addingIngredient, setAddingIngredient] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const totals = ingredients.reduce(
        (acc, ing) => {
            const factor = ing.quantityG / 100;
            acc.grams += ing.quantityG;
            acc.calories += ing.caloriesPer100g * factor;
            acc.protein += ing.proteinPer100g * factor;
            acc.carbs += ing.carbsPer100g * factor;
            acc.fat += ing.fatPer100g * factor;
            return acc;
        },
        { grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    function removeIngredient(index: number) {
        setIngredients((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleSave() {
        if (!name.trim() || ingredients.length === 0) return;
        setSaving(true);
        setError(null);
        try {
            await createRecipe({ name: name.trim(), servings, ingredients });
            onCreated();
            onClose();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal title="Nuova ricetta" onClose={onClose}>
            <label className="field">
                Nome della ricetta*
                <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Insalata di pollo" />
            </label>
            <label className="field">
                Numero di porzioni che produce
                <input type="number" min={1} step={1} value={servings} onChange={(e) => setServings(Number(e.target.value))} />
            </label>

            <p className="muted small">Ingredienti ({ingredients.length})</p>
            <ul className="entry-list">
                {ingredients.map((ing, i) => (
                    <li key={i} className="entry-item">
                        <div>
                            <div className="entry-name">{ing.name}</div>
                            <div className="muted small">
                                {ing.quantityG} g · {Math.round((ing.caloriesPer100g * ing.quantityG) / 100)} kcal
                            </div>
                        </div>
                        <button className="icon-btn" onClick={() => removeIngredient(i)} aria-label="Rimuovi ingrediente">
                            ✕
                        </button>
                    </li>
                ))}
                {ingredients.length === 0 && <li className="muted small empty">Nessun ingrediente aggiunto</li>}
            </ul>
            <button type="button" className="btn add-btn" onClick={() => setAddingIngredient(true)}>
                + Aggiungi ingrediente
            </button>

            {ingredients.length > 0 && (
                <div className="macro-preview" style={{ marginTop: 14 }}>
                    <div><strong>{Math.round(totals.calories)}</strong> kcal totali</div>
                    <div>P: {Math.round(totals.protein)} g</div>
                    <div>C: {Math.round(totals.carbs)} g</div>
                    <div>G: {Math.round(totals.fat)} g</div>
                </div>
            )}
            {ingredients.length > 0 && (
                <p className="muted small">
                    Per porzione ({Math.round(totals.grams / (servings || 1))} g): {Math.round(totals.calories / (servings || 1))} kcal
                </p>
            )}

            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
                <button className="btn secondary" onClick={onClose}>Annulla</button>
                <button
                    className="btn primary"
                    onClick={handleSave}
                    disabled={saving || !name.trim() || ingredients.length === 0}
                >
                    {saving ? "Salvo…" : "Salva ricetta"}
                </button>
            </div>

            {addingIngredient && (
                <AddIngredientModal
                    onClose={() => setAddingIngredient(false)}
                    onAdd={(ingredient) => setIngredients((prev) => [...prev, ingredient])}
                />
            )}
        </Modal>
    );
}
