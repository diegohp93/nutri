import { useEffect, useState } from "react";
import Modal from "./Modal";
import RecipeBuilderModal from "./RecipeBuilderModal";
import { deleteRecipe, listRecipes } from "../api/client";
import type { RecipeSummary } from "../types";

interface Props {
    onClose: () => void;
}

export default function RecipesModal({ onClose }: Props) {
    const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [builderOpen, setBuilderOpen] = useState(false);

    function reload() {
        setLoading(true);
        listRecipes()
            .then((r) => setRecipes(r.recipes))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        reload();
    }, []);

    async function handleDelete(id: number) {
        await deleteRecipe(id);
        reload();
    }

    return (
        <Modal title="Le mie ricette" onClose={onClose}>
            {loading && <p className="muted">Caricamento…</p>}
            {error && <p className="error">{error}</p>}
            <ul className="entry-list">
                {recipes.map((r) => (
                    <li key={r.id} className="entry-item">
                        <div>
                            <div className="entry-name">{r.name}</div>
                            <div className="muted small">
                                {r.servings} {r.servings === 1 ? "porzione" : "porzioni"} · {Math.round(r.gramsPerServing)} g/porzione ·{" "}
                                {Math.round(r.caloriesPerServing)} kcal/porzione · {r.ingredientCount} ingredienti
                            </div>
                        </div>
                        <button className="icon-btn" onClick={() => handleDelete(r.id)} aria-label="Elimina ricetta">
                            ✕
                        </button>
                    </li>
                ))}
                {!loading && recipes.length === 0 && <li className="muted small empty">Nessuna ricetta salvata</li>}
            </ul>
            <button className="btn add-btn" onClick={() => setBuilderOpen(true)}>
                + Nuova ricetta
            </button>

            {builderOpen && (
                <RecipeBuilderModal
                    onClose={() => setBuilderOpen(false)}
                    onCreated={reload}
                />
            )}
        </Modal>
    );
}
