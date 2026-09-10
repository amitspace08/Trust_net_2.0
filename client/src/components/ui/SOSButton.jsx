import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";

export default function SOSButton() {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const startHold = () => {
    timerRef.current = window.setTimeout(() => {
      navigate({ to: "/sos" });
    }, 2000);
  };

  const stopHold = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={startHold}
      onTouchEnd={stopHold}
      className="w-20 h-20 bg-red-600 rounded-full text-white text-2xl font-bold"
    >
      SOS
    </button>
  );
}
