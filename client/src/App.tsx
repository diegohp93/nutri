import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { getDay, getSettings } from "./api/client";
import type { DayResponse } from "./types";
import { MEALS } from "./types";
import MealSection from "./components/MealSection";
import ExerciseSection from "./components/ExerciseSection";
import SettingsModal from "./components/SettingsModal";

interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function pct(value: number, goal: number): number {
  return goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
}

function isOver(value: number, goal: number): boolean {
  return goal > 0 && value > goal;
}

function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayISO(): string {
  return toISODate(new Date());
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function formatDateLabel(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

export default function App() {
  const [date, setDate] = useState(todayISO());
  const [day, setDay] = useState<DayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goals, setGoals] = useState<Goals>({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    getDay(date)
      .then(setDay)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  const reloadGoals = useCallback(() => {
    getSettings().then((r) => {
      setGoals({
        calories: Number(r.settings.calorie_goal) || 0,
        protein: Number(r.settings.protein_goal_g) || 0,
        carbs: Number(r.settings.carbs_goal_g) || 0,
        fat: Number(r.settings.fat_goal_g) || 0,
      });
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    reloadGoals();
  }, [reloadGoals]);

  const totals = day?.totals;
  // stile MyFitnessPal: le calorie bruciate con l'esercizio si aggiungono all'obiettivo giornaliero
  const adjustedCalorieGoal = goals.calories > 0 ? goals.calories + (totals?.caloriesBurned ?? 0) : 0;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo" aria-hidden="true">🥗</span>
          <div>
            <h1>Nutri</h1>
            <p className="app-tagline">Il tuo diario alimentare</p>
          </div>
        </div>
        <button className="icon-btn settings-btn" onClick={() => setSettingsOpen(true)} aria-label="Impostazioni">
          ⚙️
        </button>
      </header>

      <div className="date-nav">
        <button className="date-nav-btn" onClick={() => setDate((d) => shiftDate(d, -1))} aria-label="Giorno precedente">←</button>
        <label className="date-label">
          <span className="date-title">{formatDateLabel(date)}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="date-nav-btn" onClick={() => setDate((d) => shiftDate(d, 1))} aria-label="Giorno successivo">→</button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && !day && <p className="muted">Caricamento…</p>}

      {totals && (
        <section className="card totals-card">
          {goals.calories > 0 ? (
            <div className="totals-hero">
              <div className={`totals-hero-value ${isOver(totals.calories, adjustedCalorieGoal) ? "over-goal" : ""}`}>
                {Math.round(totals.calories)}
                <span className="totals-hero-goal"> / {Math.round(adjustedCalorieGoal)}</span>
              </div>
              <div className="totals-hero-label">kcal assunte</div>
              <div className="progress-bar">
                <div
                  className={`progress-fill ${isOver(totals.calories, adjustedCalorieGoal) ? "over-goal" : ""}`}
                  style={{ width: `${pct(totals.calories, adjustedCalorieGoal)}%` }}
                />
              </div>
              {isOver(totals.calories, adjustedCalorieGoal) && (
                <span className="totals-hero-excess">
                  +{Math.round(totals.calories - adjustedCalorieGoal)} kcal oltre l'obiettivo
                </span>
              )}
            </div>
          ) : (
            <div className="totals-hero">
              <div className="totals-hero-value">{Math.round(totals.caloriesNet)}</div>
              <div className="totals-hero-label">bilancio netto (kcal)</div>
            </div>
          )}
          <div className="totals-grid">
            {goals.calories > 0 ? (
              <>
                <div className="stat-chip">
                  <span className="stat-icon">🔥</span>
                  <div>
                    <div className="totals-value">{Math.round(totals.caloriesBurned)}</div>
                    <div className="muted small">bruciate</div>
                  </div>
                </div>
                <div className="stat-chip">
                  <span className="stat-icon">⚖️</span>
                  <div>
                    <div className="totals-value">{Math.round(totals.caloriesNet)}</div>
                    <div className="muted small">bilancio netto</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="stat-chip">
                  <span className="stat-icon">🍽️</span>
                  <div>
                    <div className="totals-value">{Math.round(totals.calories)}</div>
                    <div className="muted small">assunte</div>
                  </div>
                </div>
                <div className="stat-chip">
                  <span className="stat-icon">🔥</span>
                  <div>
                    <div className="totals-value">{Math.round(totals.caloriesBurned)}</div>
                    <div className="muted small">bruciate</div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="macro-row">
            <div className={`macro-chip macro-protein ${isOver(totals.protein, goals.protein) ? "over" : ""}`}>
              <span className="macro-dot" aria-hidden="true" />
              <span>Proteine</span>
              <strong>
                {Math.round(totals.protein)}
                {goals.protein > 0 ? ` / ${goals.protein}` : ""} g
              </strong>
              {goals.protein > 0 && (
                <div className="macro-progress">
                  <div className="macro-progress-fill" style={{ width: `${pct(totals.protein, goals.protein)}%` }} />
                </div>
              )}
              {isOver(totals.protein, goals.protein) && (
                <span className="macro-excess">+{Math.round(totals.protein - goals.protein)} g</span>
              )}
            </div>
            <div className={`macro-chip macro-carbs ${isOver(totals.carbs, goals.carbs) ? "over" : ""}`}>
              <span className="macro-dot" aria-hidden="true" />
              <span>Carboidrati</span>
              <strong>
                {Math.round(totals.carbs)}
                {goals.carbs > 0 ? ` / ${goals.carbs}` : ""} g
              </strong>
              {goals.carbs > 0 && (
                <div className="macro-progress">
                  <div className="macro-progress-fill" style={{ width: `${pct(totals.carbs, goals.carbs)}%` }} />
                </div>
              )}
              {isOver(totals.carbs, goals.carbs) && (
                <span className="macro-excess">+{Math.round(totals.carbs - goals.carbs)} g</span>
              )}
            </div>
            <div className={`macro-chip macro-fat ${isOver(totals.fat, goals.fat) ? "over" : ""}`}>
              <span className="macro-dot" aria-hidden="true" />
              <span>Grassi</span>
              <strong>
                {Math.round(totals.fat)}
                {goals.fat > 0 ? ` / ${goals.fat}` : ""} g
              </strong>
              {goals.fat > 0 && (
                <div className="macro-progress">
                  <div className="macro-progress-fill" style={{ width: `${pct(totals.fat, goals.fat)}%` }} />
                </div>
              )}
              {isOver(totals.fat, goals.fat) && (
                <span className="macro-excess">+{Math.round(totals.fat - goals.fat)} g</span>
              )}
            </div>
          </div>
        </section>
      )}

      {day && (
        <div className="sections">
          {MEALS.map((meal) => (
            <MealSection
              key={meal}
              date={date}
              meal={meal}
              entries={day.meals[meal]}
              onChanged={reload}
            />
          ))}
          <ExerciseSection date={date} entries={day.exercises} onChanged={reload} />
        </div>
      )}

      {settingsOpen && (
        <SettingsModal
          onClose={() => {
            setSettingsOpen(false);
            reloadGoals();
          }}
        />
      )}
    </div>
  );
}

