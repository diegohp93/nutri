import type { FoodProduct } from "./types";

export function isBarcodeQuery(q: string): boolean {
    return /^\d{8,14}$/.test(q);
}

// Unisce i risultati "storico personale" (già inseriti/creati dall'utente) con quelli di Open Food Facts,
// mostrando prima i primi e togliendo dai secondi eventuali doppioni (stesso nome + marca).
export function mergeFoodResults(history: FoodProduct[], offResults: FoodProduct[]): FoodProduct[] {
    const historyKeys = new Set(history.map((p) => `${p.name.toLowerCase()}|${(p.brand ?? "").toLowerCase()}`));
    const filteredOff = offResults.filter(
        (p) => !historyKeys.has(`${p.name.toLowerCase()}|${(p.brand ?? "").toLowerCase()}`)
    );
    return [...history, ...filteredOff];
}
