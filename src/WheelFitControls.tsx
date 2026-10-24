import type { Placement } from "./catalog";
import { clampDiameter } from "./wheelSizing";
export default function WheelFitControls({
  wheels,
  onChange,
}: {
  wheels: Placement[];
  onChange: (index: number, diameter: number) => void;
}) {
  return (
    <section className="wheel-fit-controls" aria-labelledby="wheel-fit-title">
      <div>
        <h3 id="wheel-fit-title">Ajustar tamanho das rodas na foto</h3>
        <p>
          Aumente ou diminua cada roda até encaixar no pneu do carro. Para
          mover, arraste o centro; para redimensionar, arraste a alça ↗.
        </p>
      </div>
      <div className="wheel-fit-grid">
        {wheels.map((w, i) => {
          const side = i === 0 ? "esquerda" : "direita";
          return (
            <div className="wheel-fit-control" key={side}>
              <label htmlFor={"wheel-fit-" + i}>Roda {side} na foto</label>
              <div>
                <button
                  type="button"
                  aria-label={"Diminuir roda " + side}
                  onClick={() => onChange(i, clampDiameter(w.diameter - 0.005))}
                >
                  −
                </button>
                <input
                  id={"wheel-fit-" + i}
                  aria-label={"Tamanho da roda " + side + " na foto"}
                  type="range"
                  min="3"
                  max="65"
                  step="0.1"
                  value={w.diameter * 100}
                  onChange={(e) => onChange(i, Number(e.target.value) / 100)}
                />
                <button
                  type="button"
                  aria-label={"Aumentar roda " + side}
                  onClick={() => onChange(i, clampDiameter(w.diameter + 0.005))}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
