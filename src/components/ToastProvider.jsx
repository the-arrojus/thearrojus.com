import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Toast from "./Toast.jsx";

const ToastCtx = createContext({ showToast: () => {} });

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = "success", duration = 3000) => {
    setToast({ message, type });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </AnimatePresence>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);