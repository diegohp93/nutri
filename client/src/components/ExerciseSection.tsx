import { useState } from "react";
import type { ExerciseEntry } from "../types";
import { deleteExerciseLog } from "../api/client";
import ExerciseSearchModal from "./ExerciseSearchModal";

interface Props {
    date: string;
    entries: ExerciseEntry[];
    onChanged: () => void;
}

export default function ExerciseSection({ date, entries, onChanged }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const totalBurned = entries.reduce((s, e) => s + e.calories_burned, 0);

    async function handleDelete(id: number) {
        await deleteExerciseLog(id);
        onChanged();
    }

    return (
        <section className="card">
            <div className="card-header">
                <h2><span className="card-icon" aria-hidden="true">🏃</span>Attività sportiva</h2>
                <span className="muted">-{Math.round(totalBurned)} kcal</span>
            </div>
            <ul className="entry-list">
                {entries.map((e) => (
                    <li key={e.id} className="entry-item">
                        <div>
                            <div className="entry-name">{e.name}</div>
                            <div className="muted small">
                                {e.duration_min} min · {Math.round(e.calories_burned)} kcal bruciate
                            </div>
                        </div>
                        <button className="icon-btn" onClick={() => handleDelete(e.id)} aria-label="Rimuovi">
                            ✕
                        </button>
                    </li>
                ))}
                {entries.length === 0 && <li className="muted small empty">Nessuna attività registrata</li>}
            </ul>
            <button className="btn add-btn" onClick={() => setModalOpen(true)}>
                + Aggiungi attività
            </button>
            {modalOpen && (
                <ExerciseSearchModal date={date} onClose={() => setModalOpen(false)} onAdded={onChanged} />
            )}
        </section>
    );
}
