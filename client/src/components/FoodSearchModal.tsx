import { useEffect, useState } from "react";
import Modal from "./Modal";
import { searchFoods, searchFoodHistory, removeFoodHistory, getFoodByBarcode, addDiaryEntry } from "../api/client";
import { isBarcodeQuery, mergeFoodResults } from "../searchHelpers";
import type { FoodProduct, Meal } from "../types";

interface Props {
    date: string;
    meal: Meal;
    onClose: () => void;
    onAdded: () => void;
}

export default function FoodSearchModal({ date, meal, onClose, onAdded }: Props) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<FoodProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<FoodProduct | null>(null);
    const [unit, setUnit] = useState<"g" | "serving">("g");
    const [quantity, setQuantity] = useState(100);
    const [servings, setServings] = useState(1);
    const [saving, setSaving] = useState(false);

    const [manualMode, setManualMode] = useState(false);
    const [manualName, setManualName] = useState("");
    const [manualBrand, setManualBrand] = useState("");
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
            // I cibi già inseriti/creati dall'utente vengono mostrati per primi, prima dei risultati OFF.
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
            // La ricerca non include i dati di porzione: li recuperiamo dalla scheda prodotto completa, se disponibili.
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

    async function handleConfirm() {
        if (!selected) return;
        setSaving(true);
        try {
            await addDiaryEntry({
                date,
                meal,
                name: selected.name,
                brand: selected.brand,
                barcode: selected.code,
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

    async function handleManualConfirm() {
        if (!manualName.trim() || manualKcal === "") return;
        setSaving(true);
        try {
            const portionFactor = 100 / manualQuantity;
            await addDiaryEntry({
                date,
                meal,
                name: manualName.trim(),
                brand: manualBrand.trim() || null,
                barcode: null,
                quantityG: manualQuantity,
                caloriesPer100g: (Number(manualKcal) || 0) * portionFactor,
                proteinPer100g: (Number(manualProtein) || 0) * portionFactor,
                carbsPer100g: (Number(manualCarbs) || 0) * portionFactor,
                fatPer100g: (Number(manualFat) || 0) * portionFactor,
            });
            onAdded();
            onClose();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    }

    async function handleRemoveHistory(p: FoodProduct) {
        try {
            await removeFoodHistory(p.name, p.brand);
            setResults((current) => current.filter((item) => item !== p));
        } catch (e) {
            setError((e as Error).message);
        }
    }

    if (manualMode) {
        const factor = manualQuantity / 100;
        return (
            <Modal title="Aggiungi alimento manualmente" onClose={onClose}>
                <label className="field">
                    Nome*
                    <input
                        type="text"
                        autoFocus
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                    />
                </label>
                <label className="field">
                    Marca (opzionale)
                    <input
                        type="text"
                        value={manualBrand}
                        onChange={(e) => setManualBrand(e.target.value)}
                    />
                </label>
                <p className="muted small">Valori nutrizionali per 1 porzione (dall'etichetta del prodotto):</p>
                <label className="field">
                    Calorie (kcal/porzione)*
                    <input
                        type="number"
                        min={0}
                        value={manualKcal}
                        onChange={(e) => setManualKcal(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                </label>
                <label className="field">
                    Proteine (g/porzione)
                    <input
                        type="number"
                        min={0}
                        value={manualProtein}
                        onChange={(e) => setManualProtein(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                </label>
                <label className="field">
                    Carboidrati (g/porzione)
                    <input
                        type="number"
                        min={0}
                        value={manualCarbs}
                        onChange={(e) => setManualCarbs(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                </label>
                <label className="field">
                    Grassi (g/porzione)
                    <input
                        type="number"
                        min={0}
                        value={manualFat}
                        onChange={(e) => setManualFat(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                </label>
                <label className="field">
                    Quantità di 1 porzione (g)
                    <input
                        type="number"
                        min={1}
                        value={manualQuantity}
                        onChange={(e) => setManualQuantity(Number(e.target.value))}
                    />
                </label>
                <div className="macro-preview">
                    <div><strong>{Math.round(Number(manualKcal) || 0)}</strong> kcal</div>
                    <div>P: {Math.round(Number(manualProtein) || 0)} g</div>
                    <div>C: {Math.round(Number(manualCarbs) || 0)} g</div>
                    <div>G: {Math.round(Number(manualFat) || 0)} g</div>
                </div>
                {error && <p className="error">{error}</p>}
                <div className="modal-actions">
                    <button className="btn secondary" onClick={() => setManualMode(false)}>Indietro</button>
                    <button
                        className="btn primary"
                        onClick={handleManualConfirm}
                        disabled={saving || !manualName.trim() || manualKcal === ""}
                    >
                        {saving ? "Aggiungo…" : "Aggiungi"}
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
                        <input
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                        />
                    </label>
                )}
                {selected.servingQuantityG && (
                    <p className="muted small">
                        1 porzione = {selected.servingSize ?? `${selected.servingQuantityG} g`}
                        {" · "}totale {Math.round(gramsForSelected)} g
                    </p>
                )}
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

    return (
        <Modal title="Cerca cibo o bevanda" onClose={onClose}>
            <input
                className="search-input"
                autoFocus
                placeholder="Es. yogurt greco, mela, pasta…"
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
                                {p.source === "history" && (
                                    <button
                                        type="button"
                                        className="history-badge"
                                        title="Rimuovi dalla cronologia"
                                        aria-label={`Rimuovi ${p.name} dalla cronologia`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void handleRemoveHistory(p);
                                        }}
                                    >
                                        ★
                                    </button>
                                )}
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
                Non trovi l'alimento? Aggiungilo manualmente →
            </button>
        </Modal>
    );
}
