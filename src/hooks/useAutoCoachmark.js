import { useEffect, useState } from "react";

export function useAutoCoachmark(trigger, ms = 2400) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!trigger) {
      setShow(false);
      return;
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), ms);
    return () => clearTimeout(t);
  }, [trigger, ms]);

  return [show, setShow];
}