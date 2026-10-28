import { useState, useCallback, type ReactNode } from "react";
import { Modal } from "./modal";
import { Button } from "./button";
import { useI18n } from "@/i18n/react";

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
}

let confirmHandler: ((options: ConfirmOptions) => Promise<boolean>) | null =
  null;

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (confirmHandler) {
    return confirmHandler(options);
  }
  return Promise.resolve(
    typeof window !== "undefined" ? window.confirm(options.description) : false,
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t: tr } = useI18n();
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  confirmHandler = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (state) {
      state.resolve(result);
      setState(null);
    }
  };

  return (
    <>
      {children}
      {state && (
        <Modal
          open={state.open}
          onClose={() => handleClose(false)}
          title={state.options.title || tr("请确认操作")}
          description={state.options.description}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "20px",
            }}
          >
            <Button variant="secondary" onClick={() => handleClose(false)}>
              {state.options.cancelText || tr("取消")}
            </Button>
            <Button
              variant={
                state.options.variant === "danger" ? "danger" : "primary"
              }
              onClick={() => handleClose(true)}
            >
              {state.options.confirmText || tr("确认")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
