import { Modal } from "./Modal";

export function ConfirmDialog({
  confirmLabel = "Delete",
  message,
  onCancel,
  onConfirm,
  pending = false,
  title
}: { confirmLabel?: string; message: string; onCancel: () => void; onConfirm: () => void; pending?: boolean; title: string }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="modal-actions">
        <button className="icon-button" onClick={onCancel}>Cancel</button>
        <button className="primary-button danger" disabled={pending} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
