import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import Modal from "./Modal";

interface Props {
    onDetected: (code: string) => void;
    onClose: () => void;
}

export default function BarcodeScannerModal({ onDetected, onClose }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
    // In un ref per non far ripartire la fotocamera ad ogni render del genitore.
    const onDetectedRef = useRef(onDetected);
    onDetectedRef.current = onDetected;

    useEffect(() => {
        const reader = new BrowserMultiFormatReader();
        let stopped = false;

        reader
            .decodeFromConstraints(
                { video: { facingMode: "environment" } },
                videoRef.current!,
                (result, _err, controls) => {
                    if (result && !stopped) {
                        stopped = true;
                        controls.stop();
                        onDetectedRef.current(result.getText());
                    }
                }
            )
            .catch(() => setError("Impossibile accedere alla fotocamera. Controlla i permessi del browser."));

        return () => {
            stopped = true;
            BrowserMultiFormatReader.releaseAllStreams();
        };
    }, []);

    return (
        <Modal title="Inquadra il codice a barre" onClose={onClose}>
            {error ? (
                <p className="error">{error}</p>
            ) : (
                <video ref={videoRef} className="barcode-video" muted playsInline />
            )}
        </Modal>
    );
}
