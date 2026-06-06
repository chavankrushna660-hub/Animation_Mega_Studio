import React, { useEffect } from "react";
import { useAnimationStore } from "../store/useAnimationStore";

const Toast: React.FC = () => {
  const toast = useAnimationStore((s) => s.toast);
  const dismissToast = useAnimationStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      dismissToast();
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast?.id]);

  if (!toast) return null;

  return (
    <div
      className="fixed top-16 left-1/2 z-50 -translate-x-1/2 flex items-start gap-2 bg-amber-500 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl max-w-sm animate-bounce-in"
      style={{ animation: "slideDown 0.2s ease" }}
    >
      <span className="text-lg leading-none mt-0.5">⚠️</span>
      <span className="flex-1">{toast.message}</span>
      <button
        className="ml-2 text-white/80 hover:text-white leading-none text-lg font-bold shrink-0"
        onClick={dismissToast}
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
