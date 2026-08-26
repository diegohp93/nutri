import { useEffect, useState } from "react";
import Modal from "./Modal";
import { searchFoods, searchFoodHistory, getFoodByBarcode } from "../api/client";
import { isBarcodeQuery, mergeFoodResults } from "../searchHelpers";
import type { FoodProduct, IngredientInput } from "../types";

interface Props {
    onClose: () => void;
    onAdd: (ingredient: IngredientInput) => void;
}

// Variante di FoodSearchModal che, invece di salvare nel diario, restituisce l'ingrediente
// scelto al chiamante (usata per comporre gli ingredienti di una ricetta).
export default function AddIngredientModal({ onClose, onAdd }: Props) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<FoodProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<FoodProduct | null>(null);
    const [unit, setUnit] = useState<"g" | "serving">("g");
    const [quantity, setQuantity] = useState(100);
    const [servings, setServings] = useState(1);

    const [manualMode, setManualMode] = useState(false);
    const [manualName, setManualName] = useState("");
    const [manualKcal, setManualKcal] = useState<number | "">("");
    const [manualProtein, setManualProtein] = useState<number | "">("");
    const [manualCarbs, setManualCarbs] = useState<number | "">("");
    const [manualFat, setManualFat] = useState<number | "">("");
    const [manualQuantity, setManualQuantity] = useState(100);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            return;
        }
        const timeout = setTimeout(() => {
            setLoading(true);
            setError(null);
            // Un codice a barre (8-14 cifre) non viene trovato dalla ricerca testuale: si usa il lookup diretto.
            if (isBarcodeQuery(q)) {
                getFoodByBarcode(q)
                    .then((r) => setResults([r.product]))
                    .catch(() => setResults([]))
                    .finally(() => setLoading(false));
                return;
            }
            Promise.all([
                searchFoodHistory(q).catch(() => ({ products: [] as FoodProduct[] })),
                searchFoods(q).catch((e) => {
                    setError(e.message);
                    return { products: [] as FoodProduct[] };
                }),
            ])
                .then(([history, off]) => setResults(mergeFoodResults(history.products, off.products)))
                .finally(() => setLoading(false));
        }, 400);
        return () => clearTimeout(timeout);
    }, [query]);

    function handleSelect(p: FoodProduct) {
        setSelected(p);
        if (p.servingQuantityG) {
            setUnit("serving");
            setServings(1);
        } else {
            setUnit("g");
            setQuantity(100);
            if (p.code) {
                getFoodByBarcode(p.code)
                    .then(({ product }) => {
                        if (!product.servingQuantityG) return;
                        setSelected((prev) =>
                            prev && prev.code === product.code
                                ? { ...prev, servingSize: product.servingSize, servingQuantityG: product.servingQuantityG }
                                : prev
                        );
                        setUnit("serving");
                        setServings(1);
                    })
                    .catch(() => {
                        // Nessun problema: si continua con l'inserimento in grammi.
                    });
            }
        }
    }

    const gramsForSelected =
        selected && unit === "serving" && selected.servingQuantityG
            ? servings * selected.servingQuantityG
            : quantity;

    function handleConfirm() {
        if (!selected) return;
        onAdd({
            name: selected.brand ? `${selected.name} (${selected.brand})` : selected.name,
            quantityG: gramsForSelected,
            caloriesPer100g: selected.caloriesPer100g,
            proteinPer100g: selected.proteinPer100g,
            carbsPer100g: selected.carbsPer100g,
            fatPer100g: selected.fatPer100g,
        });
        onClose();
    }

    function handleManualConfirm() {
        if (!manualName.trim() || manualKcal === "") return;
        onAdd({
            name: manualName.trim(),
            quantityG: manualQuantity,
            caloriesPer100g: Number(manualKcal) || 0,
            proteinPer100g: Number(manualProtein) || 0,
            carbsPer100g: Number(manualCarbs) || 0,
            fatPer100g: Number(manualFat) || 0,
        });
        onClose();
    }

    if (manualMode) {
        const factor = manualQuantity / 100;
        return (
            <Modal title="Aggiungi ingrediente manualmente" onClose={onClose}>
                <label className="field">
                    Nome*
                    <input type="text" autoFocus value={manualName} onChange={(e) => setManualName(e.target.value)} />
                </label>
                <p className="muted small">Valori nutrizionali per 100 g:</p>
                <label className="field">
                    Calorie (kcal/100g)*
                    <input
                        type="number"
                        min={0}
                        value={manualKcal}
                        onChange={(e) => setManualKcal(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                </label>
                <label className="field">
                    Proteine (g/100g)
                    <input
                        type="number"
                        min={0}
                        value={manualProtein}
                        onChange={(e) => setManualProtein(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                </label>
                <label className="field">
                    Carboidrati (g/100g)
                    <input
                        type="number"
                        min={0}
                        value={manualCarbs}
                        onChange={(e) => setManualCarbs(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                </label>
                <label className="field">
                    Grassi (g/100g)
                    <input
                        type="number"
                        min={0}
                        value={manualFat}
                        onChange={(e) => setManualFat(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                </label>
                <label className="field">
                    Quantità (g)
                    <input type="number" min={1} value={manualQuantity} onChange={(e) => setManualQuantity(Number(e.target.value))} />
                </label>
                <div className="macro-preview">
                    <div><strong>{Math.round((Number(manualKcal) || 0) * factor)}</strong> kcal</div>
                    <div>P: {Math.round((Number(manualProtein) || 0) * factor)} g</div>
                    <div>C: {Math.round((Number(manualCarbs) || 0) * factor)} g</div>
                    <div>G: {Math.round((Number(manualFat) || 0) * factor)} g</div>
                </div>
                <div className="modal-actions">
                    <button className="btn secondary" onClick={() => setManualMode(false)}>Indietro</button>
                    <button
                        className="btn primary"
                        onClick={handleManualConfirm}
                        disabled={!manualName.trim() || manualKcal === ""}
                    >
                        Aggiungi ingrediente
                    </button>
                </div>
            </Modal>
        );
    }

    if (selected) {
        const factor = gramsForSelected / 100;
        return (
            <Modal title={selected.name} onClose={onClose}>
                {selected.brand && <p className="muted">{selected.brand}</p>}
                {selected.servingQuantityG && (
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
                )}
                {unit === "serving" && selected.servingQuantityG ? (
                    <label className="field">
                        Numero di porzioni
                        <input
                            type="number"
                            min={0.25}
                            step={0.25}
                            value={servings}
                            onChange={(e) => setServings(Number(e.target.value))}
                        />
                    </label>
                ) : (
                    <label className="field">
                        Quantità (g)
                        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                    </label>
                )}
                <div className="macro-preview">
                    <div><strong>{Math.round(selected.caloriesPer100g * factor)}</strong> kcal</div>
                    <div>P: {Math.round(selected.proteinPer100g * factor)} g</div>
                    <div>C: {Math.round(selected.carbsPer100g * factor)} g</div>
                    <div>G: {Math.round(selected.fatPer100g * factor)} g</div>
                </div>
                <div className="modal-actions">
                    <button className="btn secondary" onClick={() => setSelected(null)}>Indietro</button>
                    <button className="btn primary" onClick={handleConfirm}>Aggiungi ingrediente</button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal title="Cerca ingrediente" onClose={onClose}>
            <input
                className="search-input"
                autoFocus
                placeholder="Es. petto di pollo, lattuga…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {loading && <p className="muted">Ricerca in corso…</p>}
            {error && <p className="error">{error}</p>}
            <ul className="result-list">
                {results.map((p, i) => (
                    <li key={`${p.code}-${i}`} className="result-item" onClick={() => handleSelect(p)}>
                        <div>
                            <div className="result-name">
                                {p.source === "history" && <span className="history-badge" title="Già inserito da te">★</span>}
                                {p.name}
                            </div>
                            {p.brand && <div className="muted small">{p.brand}</div>}
                        </div>
                        <div className="result-kcal">{Math.round(p.caloriesPer100g)} kcal/100g</div>
                    </li>
                ))}
            </ul>
            {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
                <p className="muted">Nessun risultato su Open Food Facts.</p>
            )}
            <button type="button" className="manual-add-link" onClick={() => setManualMode(true)}>
                Non trovi l'ingrediente? Aggiungilo manualmente →
            </button>
        </Modal>
    );
}
