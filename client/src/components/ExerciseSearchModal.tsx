import { useEffect, useState } from "react";
import Modal from "./Modal";
import { searchExercises, addExerciseLog, getSettings } from "../api/client";
import type { ExerciseSearchResult } from "../types";

interface Props {
    date: string;
    onClose: () => void;
    onAdded: () => void;
}

export default function ExerciseSearchModal({ date, onClose, onAdded }: Props) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<ExerciseSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<ExerciseSearchResult | null>(null);
    const [duration, setDuration] = useState(30);
    const [weightKg, setWeightKg] = useState(70);
    const [caloriesOverride, setCaloriesOverride] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getSettings().then((r) => {
            const w = Number(r.settings.body_weight_kg);
            if (w > 0) setWeightKg(w);
        });
    }, []);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            return;
        }
        const timeout = setTimeout(() => {
            setLoading(true);
            setError(null);
            searchExercises(q)
                .then((r) => setResults(r.exercises))
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
        }, 400);
        return () => clearTimeout(timeout);
    }, [query]);

    const estimatedCalories = selected
        ? Math.round(selected.met * weightKg * (duration / 60) * 10) / 10
        : 0;

    async function handleConfirm() {
        if (!selected) return;
        setSaving(true);
        try {
            await addExerciseLog({
                date,
                name: selected.name,
                category: selected.category,
                wgerId: selected.wgerId,
                met: selected.met,
                durationMin: duration,
                caloriesOverride: caloriesOverride ?? undefined,
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
        return (
            <Modal title={selected.name} onClose={onClose}>
                <p className="muted">{selected.category}</p>
                <label className="field">
                    Durata (minuti)
                    <input
                        type="number"
                        min={1}
                        value={duration}
                        onChange={(e) => {
                            setDuration(Number(e.target.value));
                            setCaloriesOverride(null);
                        }}
                    />
                </label>
                <label className="field">
                    Calorie bruciate (stimate, modificabili)
                    <input
                        type="number"
                        min={0}
                        value={caloriesOverride ?? estimatedCalories}
                        onChange={(e) => setCaloriesOverride(Number(e.target.value))}
                    />
                </label>
                <p className="muted small">
                    Stima basata su MET={selected.met} e peso corporeo {weightKg} kg (modificabile nelle impostazioni).
                </p>
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
        <Modal title="Cerca attività sportiva" onClose={onClose}>
            <input
                className="search-input"
                autoFocus
                placeholder="Es. corsa, squat, nuoto…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {loading && <p className="muted">Ricerca in corso…</p>}
            {error && <p className="error">{error}</p>}
            <ul className="result-list">
                {results.map((ex) => (
                    <li key={ex.wgerId} className="result-item" onClick={() => setSelected(ex)}>
                        <div>
                            <div className="result-name">{ex.name}</div>
                            <div className="muted small">{ex.category}</div>
                        </div>
                    </li>
                ))}
            </ul>
            {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
                <p className="muted">Nessun risultato nel database wger.</p>
            )}
        </Modal>
    );
}
