import { useI18n } from "@/i18n/react";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X, MessageSquare } from "lucide-react";
import { FeedbackForm } from "@/modules/feedback/components/feedback-form";

const FeedbackContext = createContext<{
  openFeedback: () => void;
  closeFeedback: () => void;
}>({
  openFeedback: () => {},
  closeFeedback: () => {},
});

export const useFeedbackDialog = () => useContext(FeedbackContext);

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t: tr } = useI18n();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="auth-backdrop" />
        <Dialog.Viewport className="auth-viewport">
          <Dialog.Popup className="auth-dialog" style={{ maxWidth: "520px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <MessageSquare
                  size={20}
                  color="var(--color-primary, #6366f1)"
                />
                {tr("产品反馈与支持")}
              </h2>
              <Dialog.Close
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  opacity: 0.6,
                }}
              >
                <X size={20} />
              </Dialog.Close>
            </div>

            <FeedbackForm
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
              showCancel={true}
            />
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FloatingFeedbackButton() {
  const { t: tr } = useI18n();
  const { openFeedback } = useFeedbackDialog();

  return (
    <button
      type="button"
      className="floating-feedback-btn"
      onClick={openFeedback}
      aria-label={tr("反馈建议")}
      title={tr("反馈建议")}
    >
      <MessageSquare size={16} />
      <span className="floating-feedback-label">{tr("反馈建议")}</span>
    </button>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <FeedbackContext.Provider
      value={{
        openFeedback: () => setOpen(true),
        closeFeedback: () => setOpen(false),
      }}
    >
      {children}
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </FeedbackContext.Provider>
  );
}
