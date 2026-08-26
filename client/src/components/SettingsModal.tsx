import { useEffect, useState } from "react";
import Modal from "./Modal";
import RecipesModal from "./RecipesModal";
import { getSettings, updateSettings } from "../api/client";

interface Props {
    onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
    const [weight, setWeight] = useState<number>(70);
    const [calorieGoal, setCalorieGoal] = useState<number>(0);
    const [proteinGoal, setProteinGoal] = useState<number>(0);
    const [carbsGoal, setCarbsGoal] = useState<number>(0);
    const [fatGoal, setFatGoal] = useState<number>(0);
    const [saving, setSaving] = useState(false);
    const [recipesOpen, setRecipesOpen] = useState(false);

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
                    value={calorieGoal}
                    onChange={(e) => setCalorieGoal(Number(e.target.value))}
                    onBlur={handleGoalBlur}
                />
            </label>
            <label className="field">
                Proteine (g)
                <input
                    type="number"
                    min={0}
                    value={proteinGoal}
                    onChange={(e) => setProteinGoal(Number(e.target.value))}
                    onBlur={handleGoalBlur}
                />
            </label>
            <label className="field">
                Carboidrati (g)
                <input
                    type="number"
                    min={0}
                    value={carbsGoal}
                    onChange={(e) => setCarbsGoal(Number(e.target.value))}
                    onBlur={handleGoalBlur}
                />
            </label>
            <label className="field">
                Grassi (g)
                <input
                    type="number"
                    min={0}
                    value={fatGoal}
                    onChange={(e) => setFatGoal(Number(e.target.value))}
                    onBlur={handleGoalBlur}
                />
            </label>

            <button type="button" className="btn secondary" style={{ width: "100%", marginBottom: 12 }} onClick={() => setRecipesOpen(true)}>
                📖 Le mie ricette
            </button>
            <div className="modal-actions">
                <button className="btn secondary" onClick={onClose}>Annulla</button>
                <button className="btn primary" onClick={handleSave} disabled={saving}>
                    {saving ? "Salvo…" : "Salva"}
                </button>
            </div>
            {recipesOpen && <RecipesModal onClose={() => setRecipesOpen(false)} />}
        </Modal>
    );
}
