import { useCallback, useEffect, useRef, useState } from "react";
import dolphin from "../../../../assets/dolphin/dolphin-launcher.png";

export function Launcher() {
  const gestureRef = useRef<{
    pointerId: number;
    screenX: number;
    screenY: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [interacting, setInteracting] = useState(false);

  const endGesture = useCallback((pointerId?: number) => {
    const gesture = gestureRef.current;
    if (!gesture || (pointerId !== undefined && gesture.pointerId !== pointerId)) return;
    // Clear first: releasing capture can synchronously dispatch lostpointercapture.
    gestureRef.current = null;
    setInteracting(false);
    window.assistant.launcherDrag({ phase: "end", ...gesture });
    const button = buttonRef.current;
    if (button?.hasPointerCapture(gesture.pointerId)) {
      button.releasePointerCapture(gesture.pointerId);
    }
  }, []);

  useEffect(() => {
    const onRelease = (event: PointerEvent) => endGesture(event.pointerId);
    const onBlur = () => endGesture();
    const onVisibility = () => {
      if (document.hidden) endGesture();
    };
    // Capture-phase listeners also handle releases outside the button/renderer
    // when Chromium forwards them through pointer capture.
    window.addEventListener("pointerup", onRelease, true);
    window.addEventListener("pointercancel", onRelease, true);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      endGesture();
      window.removeEventListener("pointerup", onRelease, true);
      window.removeEventListener("pointercancel", onRelease, true);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [endGesture]);

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    endGesture();
    setInteracting(true);
    gestureRef.current = {
      pointerId: event.pointerId,
      screenX: event.screenX,
      screenY: event.screenY,
    };
    suppressClickRef.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Global release/blur listeners remain available if capture is unavailable.
    }
    window.assistant.launcherDrag({
      phase: "start",
      pointerId: event.pointerId,
      screenX: event.screenX,
      screenY: event.screenY,
    });
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if ((event.buttons & 1) === 0) {
      endGesture(event.pointerId);
      return;
    }
    const deltaX = event.screenX - gesture.screenX;
    const deltaY = event.screenY - gesture.screenY;
    const thresholdExceeded = Math.hypot(deltaX, deltaY) >= 6;
    if (thresholdExceeded && !suppressClickRef.current) {
      suppressClickRef.current = true;
    }
    window.assistant.launcherDrag({
      phase: "move",
      pointerId: event.pointerId,
      screenX: event.screenX,
      screenY: event.screenY,
    });
  }

  function onPointerEnd(event: React.PointerEvent<HTMLButtonElement>) {
    endGesture(event.pointerId);
  }

  return (
    <main className="launcher-stage" aria-label="SaleSayar floating assistant">
      <button
        ref={buttonRef}
        className="launcher-button"
        data-interacting={interacting}
        aria-label="Open SaleSayar AI assistant"
        title="Open SaleSayar AI assistant"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          void window.assistant.toggleAssistant();
        }}
      >
        <img
          src={dolphin}
          alt="Open the blue dolphin assistant"
          draggable={false}
        />
      </button>
      <span className="sr-only">Always available, always swimming</span>
    </main>
  );
}
