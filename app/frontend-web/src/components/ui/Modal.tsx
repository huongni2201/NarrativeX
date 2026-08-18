import React, { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl" | "full";
  className?: string;
}

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, subtitle, children, maxWidth = "4xl", className }) => {
  const titleId = useId();
  const descId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    const focusable = () => Array.from(contentRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    queueMicrotask(() => focusable()[0]?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        contentRef.current?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl", "2xl": "max-w-2xl", "4xl": "max-w-4xl", "6xl": "max-w-6xl", full: "max-w-[96vw] h-[92vh]" };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-describedby={subtitle ? descId : undefined} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8">
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in duration-200" onClick={onClose} aria-hidden="true" />
      <div
        ref={contentRef}
        tabIndex={-1}
        className={cn("relative w-full max-h-[calc(100vh-2rem)] bg-[#0d1420] border border-slate-800/90 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200", maxWidthStyles[maxWidth], className)}
      >
        {(title || subtitle) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#090e18]/80 shrink-0">
            <div>
              {title && <h3 id={titleId} className="text-lg font-bold text-slate-100">{title}</h3>}
              {subtitle && <p id={descId} className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Đóng hộp thoại" className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 p-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
