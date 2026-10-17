import { useI18n } from "@/i18n/react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Modal({
  open,
  onClose,
  title,
  description,
  busy = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  busy?: boolean;
  children: ReactNode;
}) {
  const { t: tr, locale } = useI18n();
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Popup className="modal-panel">
          <header className="modal-header">
            <div>
              <Dialog.Title>{tr(title)}</Dialog.Title>
              <Dialog.Description>{tr(description)}</Dialog.Description>
            </div>
            <Dialog.Close
              className="button button-ghost"
              aria-label={tr("关闭弹窗")}
              disabled={busy}
            >
              <X size={18} />
            </Dialog.Close>
          </header>
          <div className="modal-body">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
