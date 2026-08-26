import { useRef } from "react";
import type { ReactNode } from "react";

interface ModalProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
}

export default function Modal({ title, onClose, children }: ModalProps) {
    // Traccia se il mousedown è partito sull'overlay stesso, per non chiudere il popup
    // quando si seleziona del testo (es. il valore di un input) e il trascinamento
    // termina sopra l'overlay.
    const mouseDownOnOverlay = useRef(false);

    function handleOverlayMouseDown(e: React.MouseEvent<HTMLDivElement>) {
        mouseDownOnOverlay.current = e.target === e.currentTarget;
    }

    function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
        if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
            onClose();
        }
    }

    return (
        <div
            className="modal-overlay"
            onMouseDown={handleOverlayMouseDown}
            onClick={handleOverlayClick}
        >
            <div className="modal">
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
                        ✕
                    </button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
}
