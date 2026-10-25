import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Move,
  X,
} from "lucide-react";
import type { Placement } from "./catalog";
const resizeRepeat = { delay: 200, interval: 50 };
export default function WheelFitControls({
  wheels,
  selected,
  onSelect,
  onMove,
  onResize,
  initialOpen = false,
  onClose,
}: {
  wheels: Placement[];
  selected: number;
  onSelect: (i: number) => void;
  onMove: (dx: number, dy: number) => void;
  onResize: (delta: number) => void;
  initialOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    active = useRef(false);
  const handledPointer = useRef<HTMLButtonElement | null>(null);
  function stop() {
    active.current = false;
    if (timer.current) clearTimeout(timer.current);
  }
  useEffect(() => () => stop(), []);
  useEffect(() => {
    stop();
  }, [selected]);
  function start(
    event: React.PointerEvent<HTMLButtonElement>,
    action: () => void,
    timing = { delay: 350, interval: 85 },
  ) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    stop();
    active.current = true;
    handledPointer.current = event.currentTarget;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* Click fallback remains available when capture is unsupported. */
    }
    action();
    const repeat = () => {
      if (!active.current) return;
      action();
      timer.current = setTimeout(repeat, timing.interval);
    };
    timer.current = setTimeout(repeat, timing.delay);
  }
  const button = (
    label: string,
    icon: React.ReactNode,
    action: () => void,
    position?: string,
    timing?: { delay: number; interval: number },
  ) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={position}
      onPointerDown={(e) => start(e, action, timing)}
      onPointerUp={stop}
      onPointerCancel={() => {
        stop();
        handledPointer.current = null;
      }}
      onLostPointerCapture={stop}
      onBlur={stop}
      onClick={(e) => {
        const alreadyHandled =
          e.detail !== 0 && handledPointer.current === e.currentTarget;
        handledPointer.current = null;
        if (!alreadyHandled) action();
      }}
    >
      {icon}
    </button>
  );
  return (
    <>
      <div
        className="wheel-joystick"
        data-open={open}
        role="group"
        aria-label="Posicionar rodas"
      >
        <button
          type="button"
          className={open ? "joystick-toggle open" : "joystick-toggle"}
          aria-expanded={open}
          aria-label={open ? "Ocultar controles" : "Abrir controle de posição"}
          title={open ? "Ocultar controles" : "Posicionar rodas"}
          onClick={() => {
            stop();
            if (open && onClose) onClose();
            else setOpen((value) => !value);
          }}
        >
          {open ? <X size={15} /> : <Move size={15} />}
          {open ? "Ocultar controles" : "Ajustar rodas"}
        </button>
        {open && (
          <>
            <div
              className="joystick-wheel-picker"
              role="group"
              aria-label="Roda a posicionar"
            >
              {["Esquerda", "Direita"].map((name, i) => (
                <button
                  key={name}
                  type="button"
                  aria-label={"Posicionar roda " + name.toLowerCase()}
                  aria-pressed={selected === i}
                  onClick={() => onSelect(i)}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="joystick-pad">
              {button(
                "Mover roda para cima",
                <ArrowUp size={20} />,
                () => onMove(0, -1),
                "up",
              )}
              {button(
                "Mover roda para esquerda",
                <ArrowLeft size={20} />,
                () => onMove(-1, 0),
                "left",
              )}
              <span className="joystick-center" aria-hidden="true">
                {selected === 0 ? "E" : "D"}
              </span>
              {button(
                "Mover roda para direita",
                <ArrowRight size={20} />,
                () => onMove(1, 0),
                "right",
              )}
              {button(
                "Mover roda para baixo",
                <ArrowDown size={20} />,
                () => onMove(0, 1),
                "down",
              )}
            </div>
          </>
        )}
      </div>
      <div
        className="joystick-size"
        role="group"
        aria-label="Tamanho das duas rodas"
      >
        {button(
          "Diminuir as duas rodas",
          <Minus size={20} />,
          () => onResize(-1),
          undefined,
          resizeRepeat,
        )}
        <output aria-label="Tamanho das rodas">
          {Math.round(wheels[0].diameter * 100)}%
        </output>
        {button(
          "Aumentar as duas rodas",
          <Plus size={20} />,
          () => onResize(1),
          undefined,
          resizeRepeat,
        )}
      </div>
    </>
  );
}
