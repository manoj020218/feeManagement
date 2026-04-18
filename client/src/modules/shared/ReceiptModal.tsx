import { useState, useRef, useEffect } from "react";
import Modal from "./Modal";
import {
  generateReceiptImage,
  buildReceiptHTML,
  ReceiptData,
} from "../../core/services/pdfService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptData;
}

export default function ReceiptModal({ isOpen, onClose, receiptData }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      containerRef.current.innerHTML = buildReceiptHTML(receiptData);
      setTimeout(async () => {
        const img = await generateReceiptImage("receiptContainer");
        setImageUrl(img);
      }, 100);
    }
  }, [isOpen, receiptData]);

  const handleShareWhatsApp = async () => {
    // implement share logic using Capacitor Share
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `receipt_${receiptData.transaction.receiptNo}.jpg`;
    link.click();
  };

  return (
    <Modal  id="receiptModal" isOpen={isOpen} onClose={onClose} title="Receipt Ready">
      <div ref={containerRef} style={{ minHeight: 400 }} />
      <div className="btn-row" style={{ marginTop: 16, gap: 12 }}>
        <button className="btn p" onClick={handleShareWhatsApp}>
          Share via WhatsApp
        </button>
        <button className="btn g" onClick={handleDownload}>
          Save Image
        </button>
      </div>
    </Modal>
  );
}
