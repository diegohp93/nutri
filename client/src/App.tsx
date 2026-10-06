import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { getDay, getSettings, login, AuthRequiredError } from "./api/client";
import type { DayResponse } from "./types";
import { MEALS } from "./types";
import MealSection from "./components/MealSection";
import ExerciseSection from "./components/ExerciseSection";
import SettingsModal from "./components/SettingsModal";
import RecipesModal from "./components/RecipesModal";
import AccountModal from "./components/AccountModal";

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
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [goals, setGoals] = useState<Goals>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [authRequired, setAuthRequired] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    getDay(date)
      .then(setDay)
      .catch((e) => {
        if (e instanceof AuthRequiredError) setAuthRequired(true);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [date]);

  const reloadGoals = useCallback(() => {
    getSettings()
      .then((r) => {
        setGoals({
          calories: Number(r.settings.calorie_goal) || 0,
          protein: Number(r.settings.protein_goal_g) || 0,
          carbs: Number(r.settings.carbs_goal_g) || 0,
          fat: Number(r.settings.fat_goal_g) || 0,
        });
      })
      .catch((e) => {
        if (e instanceof AuthRequiredError) setAuthRequired(true);
      });
  }, []);

  function handleLogin() {
    if (!username.trim() || !password) return;
    setLoginError(null);
    login(username.trim(), password)
      .then(() => {
        setPassword("");
        setAuthRequired(false);
        reload();
        reloadGoals();
      })
      .catch((e) => setLoginError(e.message));
  }

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    reloadGoals();
  }, [reloadGoals]);

  if (authRequired) {
    return (
      <div className="app">
        <section className="card" style={{ maxWidth: 360, margin: "80px auto" }}>
          <h2 style={{ marginTop: 0 }}>Accesso richiesto</h2>
          <p className="muted small">Accedi con le tue credenziali per usare Nutri.</p>
          <label className="field">
            Username
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </label>
          {loginError && <p className="error small">{loginError}</p>}
          <div className="modal-actions">
            <button className="btn primary" onClick={handleLogin}>Accedi</button>
          </div>
        </section>
      </div>
    );
  }

  const totals = day?.totals;
  // stile MyFitnessPal: le calorie bruciate con l'esercizio si aggiungono all'obiettivo giornaliero
  const adjustedCalorieGoal = goals.calories > 0 ? goals.calories + (totals?.caloriesBurned ?? 0) : 0;
  // i grammi target di P/C/G si scalano dello stesso fattore, così il rapporto tra macro resta invariato
  const macroScaleFactor = goals.calories > 0 ? adjustedCalorieGoal / goals.calories : 1;
  const adjustedProteinGoal = goals.protein * macroScaleFactor;
  const adjustedCarbsGoal = goals.carbs * macroScaleFactor;
  const adjustedFatGoal = goals.fat * macroScaleFactor;


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
        <div className="header-actions">
          <button className="icon-btn settings-btn" onClick={() => setRecipesOpen(true)} aria-label="Ricette">
            📖
          </button>
          <button className="icon-btn settings-btn" onClick={() => setSettingsOpen(true)} aria-label="Impostazioni">
            🎯
          </button>
          <button className="icon-btn settings-btn" onClick={() => setAccountOpen(true)} aria-label="Account">
            👤
          </button>
        </div>
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
            <div className={`macro-chip macro-protein ${isOver(totals.protein, adjustedProteinGoal) ? "over" : ""}`}>
              <span className="macro-dot" aria-hidden="true" />
              <span>Proteine</span>
              <strong>
                {Math.round(totals.protein)}
                {adjustedProteinGoal > 0 ? ` / ${Math.round(adjustedProteinGoal)}` : ""} g
              </strong>
              {adjustedProteinGoal > 0 && (
                <div className="macro-progress">
                  <div className="macro-progress-fill" style={{ width: `${pct(totals.protein, adjustedProteinGoal)}%` }} />
                </div>
              )}
              {isOver(totals.protein, adjustedProteinGoal) && (
                <span className="macro-excess">+{Math.round(totals.protein - adjustedProteinGoal)} g</span>
              )}
            </div>
            <div className={`macro-chip macro-carbs ${isOver(totals.carbs, adjustedCarbsGoal) ? "over" : ""}`}>
              <span className="macro-dot" aria-hidden="true" />
              <span>Carboidrati</span>
              <strong>
                {Math.round(totals.carbs)}
                {adjustedCarbsGoal > 0 ? ` / ${Math.round(adjustedCarbsGoal)}` : ""} g
              </strong>
              {adjustedCarbsGoal > 0 && (
                <div className="macro-progress">
                  <div className="macro-progress-fill" style={{ width: `${pct(totals.carbs, adjustedCarbsGoal)}%` }} />
                </div>
              )}
              {isOver(totals.carbs, adjustedCarbsGoal) && (
                <span className="macro-excess">+{Math.round(totals.carbs - adjustedCarbsGoal)} g</span>
              )}
            </div>
            <div className={`macro-chip macro-fat ${isOver(totals.fat, adjustedFatGoal) ? "over" : ""}`}>
              <span className="macro-dot" aria-hidden="true" />
              <span>Grassi</span>
              <strong>
                {Math.round(totals.fat)}
                {adjustedFatGoal > 0 ? ` / ${Math.round(adjustedFatGoal)}` : ""} g
              </strong>
              {adjustedFatGoal > 0 && (
                <div className="macro-progress">
                  <div className="macro-progress-fill" style={{ width: `${pct(totals.fat, adjustedFatGoal)}%` }} />
                </div>
              )}
              {isOver(totals.fat, adjustedFatGoal) && (
                <span className="macro-excess">+{Math.round(totals.fat - adjustedFatGoal)} g</span>
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
      {recipesOpen && <RecipesModal onClose={() => setRecipesOpen(false)} />}
      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
    </div>
  );
}

