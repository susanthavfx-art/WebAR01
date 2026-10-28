import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { publicUrl } from "../lib/deployment";
// Company logo files live in public/brand. Replace those PNGs to rebrand.
export const BRAND_NAME = "WonderLab Studio";
export const BRAND_MARK = publicUrl("brand/wonderlab-mark-256.png");
export const BRAND_LOGO = publicUrl("brand/wonderlab-logo-512.png");
export function Logo({ small = false, full = false }) {
  if (full)
    return <img className="brand-full" src={BRAND_LOGO} alt={BRAND_NAME} />;
  return (
    <span className={`brand ${small ? "brand-small" : ""}`}>
      <img className="brand-mark" src={BRAND_MARK} alt="" />
      <span className="brand-word">
        Wonder<span className="brand-lab">Lab</span>
      </span>
    </span>
  );
}
export function IconButton({ label, children, className = "", ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`icon-button ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Modal({ children, onClose, className = "", label = "Dialog" }) {
  const box = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () => [
      ...box.current.querySelectorAll(
        'button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]',
      ),
    ];
    focusable()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const f = focusable(),
          first = f[0],
          last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`modal ${className}`}
      >
        <IconButton
          label="Close dialog"
          className="modal-close"
          onClick={onClose}
        >
          <X size={19} />
        </IconButton>
        {children}
      </section>
    </div>
  );
}
export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={32} />}
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
