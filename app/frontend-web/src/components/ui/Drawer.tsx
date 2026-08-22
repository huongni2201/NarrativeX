"use client";

import { useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useOverlayFocus } from "./useOverlayFocus";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel?: string;
  title?: string;
  closeDisabled?: boolean;
  children: ReactNode;
  className?: string;
}

export function Drawer({
  isOpen,
  onClose,
  ariaLabel,
  title,
  closeDisabled = false,
  children,
  className,
}: Readonly<DrawerProps>) {
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlayFocus(isOpen, onClose, closeDisabled, contentRef);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden overscroll-contain border-l border-border bg-surface-card shadow-2xl",
          className,
        )}
      >
        {title && <h2 id={titleId} className="sr-only">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
