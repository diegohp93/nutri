import { useState } from "react";
import type { DiaryEntry, Meal } from "../types";
import { MEAL_ICONS, MEAL_LABELS } from "../types";
import { deleteDiaryEntry, updateDiaryEntryQuantity } from "../api/client";
import FoodSearchModal from "./FoodSearchModal";
import RecipeSearchModal from "./RecipeSearchModal";

interface Props {
    date: string;
    meal: Meal;
    entries: DiaryEntry[];
    onChanged: () => void;
}

export default function MealSection({ date, meal, entries, onChanged }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [recipeModalOpen, setRecipeModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editQuantity, setEditQuantity] = useState(0);
    const [savingEdit, setSavingEdit] = useState(false);
    const totalCalories = entries.reduce((s, e) => s + e.calories, 0);

    async function handleDelete(id: number) {
        await deleteDiaryEntry(id);
        onChanged();
    }

    function startEdit(entry: DiaryEntry) {
        setEditingId(entry.id);
        setEditQuantity(entry.quantity_g);
    }

    function cancelEdit() {
        setEditingId(null);
    }

    async function confirmEdit(id: number) {
        if (editQuantity <= 0) return;
        setSavingEdit(true);
        try {
            await updateDiaryEntryQuantity(id, editQuantity);
            setEditingId(null);
            onChanged();
        } finally {
            setSavingEdit(false);
        }
    }

    return (
        <section className="card">
            <div className="card-header">
                <h2><span className="card-icon" aria-hidden="true">{MEAL_ICONS[meal]}</span>{MEAL_LABELS[meal]}</h2>
                <span className="muted">{Math.round(totalCalories)} kcal</span>
            </div>
            <ul className="entry-list">
                {entries.map((e) => (
                    <li key={e.id} className="entry-item">
                        {editingId === e.id ? (
                            <>
                                <div className="entry-edit">
                                    <span className="entry-name">{e.name}</span>
                                    <input
                                        type="number"
                                        min={1}
                                        autoFocus
                                        value={editQuantity}
                                        onChange={(ev) => setEditQuantity(Number(ev.target.value))}
                                    />
                                    <span className="muted small">g</span>
                                </div>
                                <div className="entry-actions">
                                    <button
                                        className="icon-btn"
                                        onClick={() => confirmEdit(e.id)}
                                        disabled={savingEdit}
                                        aria-label="Conferma quantità"
                                    >
                                        ✓
                                    </button>
                                    <button className="icon-btn" onClick={cancelEdit} aria-label="Annulla modifica">
                                        ✕
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <div className="entry-name">{e.name}</div>
                                    <div className="muted small">
                                        {e.quantity_g} g · {Math.round(e.calories)} kcal · P {Math.round(e.protein)}g · C {Math.round(e.carbs)}g · G {Math.round(e.fat)}g
                                    </div>
                                </div>
                                <div className="entry-actions">
                                    <button className="icon-btn" onClick={() => startEdit(e)} aria-label="Modifica quantità">
                                        ✏️
                                    </button>
                                    <button className="icon-btn" onClick={() => handleDelete(e.id)} aria-label="Rimuovi">
                                        ✕
                                    </button>
                                </div>
                            </>
                        )}
                    </li>
                ))}
                {entries.length === 0 && <li className="muted small empty">Nessun alimento aggiunto</li>}
            </ul>
            <div className="meal-actions">
                <button className="btn add-btn" onClick={() => setModalOpen(true)}>
                    + Aggiungi cibo
                </button>
                <button className="btn add-btn recipe-btn" onClick={() => setRecipeModalOpen(true)}>
                    📖 Usa una ricetta
                </button>
            </div>
            {modalOpen && (
                <FoodSearchModal
                    date={date}
                    meal={meal}
                    onClose={() => setModalOpen(false)}
                    onAdded={onChanged}
                />
            )}
            {recipeModalOpen && (
                <RecipeSearchModal
                    date={date}
                    meal={meal}
                    onClose={() => setRecipeModalOpen(false)}
                    onAdded={onChanged}
                />
            )}
        </section>
    );
}
