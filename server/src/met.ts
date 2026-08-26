// Tabella MET (Metabolic Equivalent of Task) approssimata per categoria muscolare wger,
// usata per stimare le calorie bruciate quando l'utente non le inserisce manualmente.
// Fonte valori: Compendium of Physical Activities (valori medi arrotondati).
export const MET_BY_CATEGORY: Record<string, number> = {
    Abs: 4.5,
    Arms: 3.5,
    Back: 5,
    Calves: 3.5,
    Chest: 5,
    Legs: 6,
    Shoulders: 4,
    Cardio: 8,
    Default: 5,
};

export function estimateCalories(met: number, weightKg: number, durationMin: number): number {
    const hours = durationMin / 60;
    return Math.round(met * weightKg * hours * 10) / 10;
}
