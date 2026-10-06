import { useEffect, useState } from "react";
import Modal from "./Modal";
import { getSettings, updateSettings } from "../api/client";

interface Props {
    onClose: () => void;
}

// frecce custom al posto di quelle native del browser, cosi possiamo posizionarle dove vogliamo
function Stepper({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
    return (
        <span className="field-input-stepper">
            <button type="button" tabIndex={-1} aria-label="Aumenta" onClick={onUp}>▲</button>
            <button type="button" tabIndex={-1} aria-label="Diminuisci" onClick={onDown}>▼</button>
        </span>
    );
}

type MacroKey = "proteinGoal" | "carbsGoal" | "fatGoal";

export default function SettingsModal({ onClose }: Props) {
    const [weight, setWeight] = useState<number>(70);
    const [calorieGoal, setCalorieGoal] = useState<number>(0);
    const [proteinGoal, setProteinGoal] = useState<number>(0);
    const [carbsGoal, setCarbsGoal] = useState<number>(0);
    const [fatGoal, setFatGoal] = useState<number>(0);
    const [macroUnit, setMacroUnit] = useState<"g" | "pct">("g");
    const [saving, setSaving] = useState(false);

    // percentuali e grammi sono sempre la stessa fonte di verità (i grammi), solo rappresentazioni diverse
    function gramsToPct(grams: number, kcalPerG: number): number {
        return calorieGoal > 0 ? (grams * kcalPerG * 100) / calorieGoal : 0;
    }
    function pctToGrams(pct: number, kcalPerG: number): number {
        return calorieGoal > 0 ? (pct * calorieGoal) / 100 / kcalPerG : 0;
    }
    // se le calorie non sono impostate le percentuali non hanno un totale da cui derivare i grammi
    const effectiveMacroUnit = calorieGoal > 0 ? macroUnit : "g";

    useEffect(() => {
        getSettings().then((r) => {
            const w = Number(r.settings.body_weight_kg);
            if (w > 0) setWeight(w);
            setCalorieGoal(Number(r.settings.calorie_goal) || 0);
            setProteinGoal(Number(r.settings.protein_goal_g) || 0);
            setCarbsGoal(Number(r.settings.carbs_goal_g) || 0);
            setFatGoal(Number(r.settings.fat_goal_g) || 0);
        });
    }, []);

    // Se esattamente 3 dei 4 obiettivi sono impostati, calcola il quarto per completamento logico
    // (proteine e carboidrati = 4 kcal/g, grassi = 9 kcal/g).
    function autoCompleteGoal(next: {
        calorieGoal: number;
        proteinGoal: number;
        carbsGoal: number;
        fatGoal: number;
    }) {
        const zeroKeys = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] === 0);
        if (zeroKeys.length !== 1) return;
        const { calorieGoal, proteinGoal, carbsGoal, fatGoal } = next;
        if (zeroKeys[0] === "fatGoal") {
            const fat = (calorieGoal - proteinGoal * 4 - carbsGoal * 4) / 9;
            if (fat > 0) setFatGoal(Math.round(fat));
        } else if (zeroKeys[0] === "carbsGoal") {
            const carbs = (calorieGoal - proteinGoal * 4 - fatGoal * 9) / 4;
            if (carbs > 0) setCarbsGoal(Math.round(carbs));
        } else if (zeroKeys[0] === "proteinGoal") {
            const protein = (calorieGoal - carbsGoal * 4 - fatGoal * 9) / 4;
            if (protein > 0) setProteinGoal(Math.round(protein));
        } else {
            const kcal = proteinGoal * 4 + carbsGoal * 4 + fatGoal * 9;
            if (kcal > 0) setCalorieGoal(Math.round(kcal));
        }
    }

    // Calcola il quarto obiettivo solo quando si esce da un campo con un valore completo,
    // non ad ogni carattere digitato (altrimenti userebbe cifre intermedie incomplete).
    function handleGoalBlur() {
        autoCompleteGoal({ calorieGoal, proteinGoal, carbsGoal, fatGoal });
    }

    const kcalPerGram: Record<MacroKey, number> = { proteinGoal: 4, carbsGoal: 4, fatGoal: 9 };
    const macroSetters: Record<MacroKey, (v: number) => void> = {
        proteinGoal: setProteinGoal,
        carbsGoal: setCarbsGoal,
        fatGoal: setFatGoal,
    };
    const macroValues: Record<MacroKey, number> = { proteinGoal, carbsGoal, fatGoal };

    // le frecce dello stepper lavorano sempre sui grammi, completando subito il 4° obiettivo come il blur
    function adjustGrams(key: MacroKey, delta: number) {
        const next = Math.max(0, macroValues[key] + delta);
        macroSetters[key](next);
        autoCompleteGoal({ calorieGoal, proteinGoal, carbsGoal, fatGoal, [key]: next });
    }
    function adjustPercent(key: MacroKey, delta: number) {
        const kcalPerG = kcalPerGram[key];
        const currentPct = Math.round(gramsToPct(macroValues[key], kcalPerG));
        const nextPct = Math.max(0, Math.min(100, currentPct + delta));
        const nextGrams = Math.round(pctToGrams(nextPct, kcalPerG));
        macroSetters[key](nextGrams);
        autoCompleteGoal({ calorieGoal, proteinGoal, carbsGoal, fatGoal, [key]: nextGrams });
    }

    async function handleSave() {
        setSaving(true);
        try {
            await updateSettings({
                body_weight_kg: weight,
                calorie_goal: calorieGoal,
                protein_goal_g: proteinGoal,
                carbs_goal_g: carbsGoal,
                fat_goal_g: fatGoal,
            });
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal title="Impostazioni" onClose={onClose}>
            <label className="field">
                Peso corporeo (kg)
                <input
                    type="number"
                    min={1}
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                />
            </label>
            <p className="muted small">
                Usato per stimare le calorie bruciate durante le attività sportive.
            </p>

            <p className="muted small">
                Obiettivi giornalieri (0 = nessun obiettivo). Se ne compili 3, il quarto si calcola da solo.
            </p>
            <label className="field">
                Calorie (kcal)
                <input
                    type="number"
                    min={0}
                    value={calorieGoal}
                    onChange={(e) => setCalorieGoal(Number(e.target.value))}
                    onBlur={handleGoalBlur}
                />
            </label>

            <div className="macro-unit-row">
                <span className="muted small">Obiettivi macro in:</span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={effectiveMacroUnit === "pct"}
                    className={`macro-unit-switch ${effectiveMacroUnit === "g" ? "is-g" : ""}`}
                    onClick={() => setMacroUnit(effectiveMacroUnit === "g" ? "pct" : "g")}
                    disabled={calorieGoal <= 0}
                    title={calorieGoal <= 0 ? "Imposta prima le calorie per usare le percentuali" : undefined}
                >
                    <span className={`macro-unit-switch-label ${effectiveMacroUnit === "pct" ? "is-active" : ""}`}>%</span>
                    <span className={`macro-unit-switch-label ${effectiveMacroUnit === "g" ? "is-active" : ""}`}>g</span>
                    <span className="macro-unit-switch-thumb" />
                </button>
            </div>

            {effectiveMacroUnit === "g" ? (
                <>
                    <label className="field">
                        Proteine (g)
                        <div className="field-input-wrap">
                            <input
                                type="number"
                                min={0}
                                value={proteinGoal}
                                onChange={(e) => setProteinGoal(Number(e.target.value))}
                                onBlur={handleGoalBlur}
                            />
                            {calorieGoal > 0 && <span className="field-input-hint">≈ {Math.round(gramsToPct(proteinGoal, 4))}%</span>}
                            <Stepper onUp={() => adjustGrams("proteinGoal", 1)} onDown={() => adjustGrams("proteinGoal", -1)} />
                        </div>
                    </label>
                    <label className="field">
                        Carboidrati (g)
                        <div className="field-input-wrap">
                            <input
                                type="number"
                                min={0}
                                value={carbsGoal}
                                onChange={(e) => setCarbsGoal(Number(e.target.value))}
                                onBlur={handleGoalBlur}
                            />
                            {calorieGoal > 0 && <span className="field-input-hint">≈ {Math.round(gramsToPct(carbsGoal, 4))}%</span>}
                            <Stepper onUp={() => adjustGrams("carbsGoal", 1)} onDown={() => adjustGrams("carbsGoal", -1)} />
                        </div>
                    </label>
                    <label className="field">
                        Grassi (g)
                        <div className="field-input-wrap">
                            <input
                                type="number"
                                min={0}
                                value={fatGoal}
                                onChange={(e) => setFatGoal(Number(e.target.value))}
                                onBlur={handleGoalBlur}
                            />
                            {calorieGoal > 0 && <span className="field-input-hint">≈ {Math.round(gramsToPct(fatGoal, 9))}%</span>}
                            <Stepper onUp={() => adjustGrams("fatGoal", 1)} onDown={() => adjustGrams("fatGoal", -1)} />
                        </div>
                    </label>
                </>
            ) : (
                <>
                    <label className="field">
                        Proteine (%)
                        <div className="field-input-wrap">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={Math.round(gramsToPct(proteinGoal, 4))}
                                onChange={(e) => setProteinGoal(Math.round(pctToGrams(Number(e.target.value), 4)))}
                                onBlur={handleGoalBlur}
                            />
                            <span className="field-input-hint">≈ {proteinGoal} g</span>
                            <Stepper onUp={() => adjustPercent("proteinGoal", 1)} onDown={() => adjustPercent("proteinGoal", -1)} />
                        </div>
                    </label>
                    <label className="field">
                        Carboidrati (%)
                        <div className="field-input-wrap">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={Math.round(gramsToPct(carbsGoal, 4))}
                                onChange={(e) => setCarbsGoal(Math.round(pctToGrams(Number(e.target.value), 4)))}
                                onBlur={handleGoalBlur}
                            />
                            <span className="field-input-hint">≈ {carbsGoal} g</span>
                            <Stepper onUp={() => adjustPercent("carbsGoal", 1)} onDown={() => adjustPercent("carbsGoal", -1)} />
                        </div>
                    </label>
                    <label className="field">
                        Grassi (%)
                        <div className="field-input-wrap">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={Math.round(gramsToPct(fatGoal, 9))}
                                onChange={(e) => setFatGoal(Math.round(pctToGrams(Number(e.target.value), 9)))}
                                onBlur={handleGoalBlur}
                            />
                            <span className="field-input-hint">≈ {fatGoal} g</span>
                            <Stepper onUp={() => adjustPercent("fatGoal", 1)} onDown={() => adjustPercent("fatGoal", -1)} />
                        </div>
                    </label>
                </>
            )}

            <div className="modal-actions">
                <button className="btn secondary" onClick={onClose}>Annulla</button>
                <button className="btn primary" onClick={handleSave} disabled={saving}>
                    {saving ? "Salvo…" : "Salva"}
                </button>
            </div>
        </Modal>
    );
}
