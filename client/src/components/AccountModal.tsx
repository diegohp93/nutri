import Modal from "./Modal";
import { getUsername, logout } from "../api/client";

interface Props {
    onClose: () => void;
}

export default function AccountModal({ onClose }: Props) {
    const username = getUsername();

    async function handleLogout() {
        await logout();
        window.location.reload();
    }

    return (
        <Modal title="Account" onClose={onClose}>
            {username && <p className="muted small">Accesso come <strong>{username}</strong></p>}
            <div className="modal-actions">
                <button className="btn secondary" onClick={onClose}>Chiudi</button>
                <button className="btn primary" onClick={handleLogout}>Esci</button>
            </div>
        </Modal>
    );
}
