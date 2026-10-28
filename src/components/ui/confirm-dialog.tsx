import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
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

  const pendingResolveRef = useRef<((val: boolean) => void) | null>(null);

  useEffect(() => {
    confirmHandler = (options: ConfirmOptions) => {
      if (pendingResolveRef.current) {
        pendingResolveRef.current(false);
      }
      return new Promise<boolean>((resolve) => {
        pendingResolveRef.current = resolve;
        setState({
          open: true,
          options,
          resolve,
        });
      });
    };
    return () => {
      confirmHandler = null;
    };
  }, []);

  const handleClose = useCallback((result: boolean) => {
    if (pendingResolveRef.current) {
      pendingResolveRef.current(result);
      pendingResolveRef.current = null;
    }
    setState(null);
  }, []);

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
