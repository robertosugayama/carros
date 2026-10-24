import type { Placement } from "./catalog";
export default function WheelFitControls({
  wheels,
  onChange,
}: {
  wheels: Placement[];
  onChange: (index: number, diameter: number) => void;
}) {
  const diameter = wheels[0].diameter;
  return (
    <section className="wheel-fit-controls" aria-labelledby="wheel-fit-title">
      <div>
        <h3 id="wheel-fit-title">Ajustar tamanho das duas rodas</h3>
        <p>
          As duas rodas aumentam e diminuem juntas pela barra horizontal. Para
          posicionar cada roda, arraste sua imagem.
        </p>
      </div>
      <div className="wheel-fit-control">
        <label htmlFor="wheel-fit-both">Tamanho das duas rodas na foto</label>
        <div>
          <input
            id="wheel-fit-both"
            aria-label="Tamanho das duas rodas na foto"
            type="range"
            min="3"
            max="65"
            step="0.1"
            value={diameter * 100}
            onChange={(e) => onChange(0, Number(e.target.value) / 100)}
          />
        </div>
      </div>
    </section>
  );
}
