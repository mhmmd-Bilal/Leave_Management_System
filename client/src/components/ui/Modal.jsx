import { X } from "lucide-react";
import { useEffect, useRef } from "react";

// Open modals, topmost last. Only the topmost one reacts to Escape, so closing a confirmation
// dialog does not also close the dialog underneath it.
const stack = [];
let savedOverflow = "";

export default function Modal({ open, onClose, title, children, footer, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // always the latest callback, without re-running the effect below

  // Runs only when the dialog opens/closes. (It used to depend on `onClose`, which parents pass
  // inline, so every keystroke in a form re-ran it and pulled focus out of the input being typed in.)
  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    stack.push(token);
    const previouslyFocused = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape" && stack[stack.length - 1] === token) closeRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    if (stack.length === 1) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden"; // lock page scroll while any dialog is open
    }
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(token), 1);
      if (stack.length === 0) document.body.style.overflow = savedOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-pop outline-none sm:rounded-lg ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-serif text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
