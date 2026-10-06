import { useEffect, useState } from "react";
import Modal from "./Modal";
import { getSettings, updateSettings } from "../api/client";

interface Props {
    onClose: () => void;
}

// oltre questa soglia le calorie giornaliere non hanno senso per nessuna persona reale
const CALORIE_GOAL_MAX = 10000;

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

    // stessa regola in entrambe le unità: % che sommano a 100 equivale a grammi che coprono esattamente le kcal totali
    const macroPctSum = Math.round(gramsToPct(proteinGoal, 4) + gramsToPct(carbsGoal, 4) + gramsToPct(fatGoal, 9));
    const anyMacroSet = proteinGoal > 0 || carbsGoal > 0 || fatGoal > 0;
    const macroMismatch = calorieGoal > 0 && anyMacroSet && macroPctSum !== 100;
    const calorieTooHigh = calorieGoal > CALORIE_GOAL_MAX;

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
                    max={CALORIE_GOAL_MAX}
                    className={calorieTooHigh ? "input-error" : undefined}
                    value={calorieGoal}
                    onChange={(e) => setCalorieGoal(Number(e.target.value))}
                    onBlur={handleGoalBlur}
                />
            </label>
            {calorieTooHigh && (
                <p className="error small">Obiettivo calorico non plausibile (max {CALORIE_GOAL_MAX} kcal).</p>
            )}

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
                                max={calorieGoal > 0 ? Math.round(calorieGoal / 4) : undefined}
                                className={macroMismatch ? "input-error" : undefined}
                                value={proteinGoal}
                                onChange={(e) => setProteinGoal(Number(e.target.value))}
                                onBlur={handleGoalBlur}
                            />
                            {calorieGoal > 0 && <span className="field-input-hint">≈ {Math.round(gramsToPct(proteinGoal, 4))}%</span>}
                        </div>
                    </label>
                    <label className="field">
                        Carboidrati (g)
                        <div className="field-input-wrap">
                            <input
                                type="number"
                                min={0}
                                max={calorieGoal > 0 ? Math.round(calorieGoal / 4) : undefined}
                                className={macroMismatch ? "input-error" : undefined}
                                value={carbsGoal}
                                onChange={(e) => setCarbsGoal(Number(e.target.value))}
                                onBlur={handleGoalBlur}
                            />
                            {calorieGoal > 0 && <span className="field-input-hint">≈ {Math.round(gramsToPct(carbsGoal, 4))}%</span>}
                        </div>
                    </label>
                    <label className="field">
                        Grassi (g)
                        <div className="field-input-wrap">
                            <input
                                type="number"
                                min={0}
                                max={calorieGoal > 0 ? Math.round(calorieGoal / 9) : undefined}
                                className={macroMismatch ? "input-error" : undefined}
                                value={fatGoal}
                                onChange={(e) => setFatGoal(Number(e.target.value))}
                                onBlur={handleGoalBlur}
                            />
                            {calorieGoal > 0 && <span className="field-input-hint">≈ {Math.round(gramsToPct(fatGoal, 9))}%</span>}
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
                                className={macroMismatch ? "input-error" : undefined}
                                value={Math.round(gramsToPct(proteinGoal, 4))}
                                onChange={(e) => setProteinGoal(Math.round(pctToGrams(Number(e.target.value), 4)))}
                                onBlur={handleGoalBlur}
                            />
                            <span className="field-input-hint">≈ {proteinGoal} g</span>
                        </div>
                    </label>
                    <label className="field">
                        Carboidrati (%)
                        <div className="field-input-wrap">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                className={macroMismatch ? "input-error" : undefined}
                                value={Math.round(gramsToPct(carbsGoal, 4))}
                                onChange={(e) => setCarbsGoal(Math.round(pctToGrams(Number(e.target.value), 4)))}
                                onBlur={handleGoalBlur}
                            />
                            <span className="field-input-hint">≈ {carbsGoal} g</span>
                        </div>
                    </label>
                    <label className="field">
                        Grassi (%)
                        <div className="field-input-wrap">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                className={macroMismatch ? "input-error" : undefined}
                                value={Math.round(gramsToPct(fatGoal, 9))}
                                onChange={(e) => setFatGoal(Math.round(pctToGrams(Number(e.target.value), 9)))}
                                onBlur={handleGoalBlur}
                            />
                            <span className="field-input-hint">≈ {fatGoal} g</span>
                        </div>
                    </label>
                </>
            )}

            {macroMismatch && (
                <p className="error small">
                    Le percentuali sommano a {macroPctSum}% invece di 100%. Correggi i valori prima di salvare.
                </p>
            )}

            <div className="modal-actions">
                <button className="btn secondary" onClick={onClose}>Annulla</button>
                <button className="btn primary" onClick={handleSave} disabled={saving || macroMismatch || calorieTooHigh}>
                    {saving ? "Salvo…" : "Salva"}
                </button>
            </div>
        </Modal>
    );
}
