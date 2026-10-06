import { useState } from "react";
import Modal from "./Modal";
import { changePassword, getUsername, logout } from "../api/client";

interface Props {
    onClose: () => void;
}

export default function AccountModal({ onClose }: Props) {
    const username = getUsername();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    async function handleLogout() {
        await logout();
        window.location.reload();
    }

    async function handleChangePassword() {
        setError(null);
        setSuccess(false);
        if (!currentPassword || !newPassword) return;
        if (newPassword !== confirmPassword) {
            setError("Le due password non coincidono");
            return;
        }
        setSaving(true);
        try {
            await changePassword(currentPassword, newPassword);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setSuccess(true);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal title="Account" onClose={onClose}>
            {username && <p className="muted small">Accesso come <strong>{username}</strong></p>}

            <p className="muted small">Cambia password</p>
            <label className="field">
                Password attuale
                <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                />
            </label>
            <label className="field">
                Nuova password
                <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                />
            </label>
            <label className="field">
                Conferma nuova password
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                />
            </label>
            {error && <p className="error small">{error}</p>}
            {success && <p className="muted small">Password aggiornata.</p>}
            <div className="modal-actions">
                <button className="btn secondary" onClick={handleChangePassword} disabled={saving}>
                    {saving ? "Salvo…" : "Cambia password"}
                </button>
            </div>

            <div className="modal-actions">
                <button className="btn secondary" onClick={onClose}>Chiudi</button>
                <button className="btn primary" onClick={handleLogout}>Esci</button>
            </div>
        </Modal>
    );
}
