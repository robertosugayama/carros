import { useEffect, useRef, useState } from "react";
import { Camera, Check, Upload } from "lucide-react";
import { models, finishes } from "./catalog";
import type { WheelPhoto } from "./PhotoCatalog";
export default function PhotoUpload({
  onSave,
  notify,
  onTreat,
  shared = false,
}: {
  onSave: (p: Omit<WheelPhoto, "id">) => Promise<void>;
  notify: (s: string) => void;
  onTreat?: (image: string, kind: "rim" | "assembly") => Promise<string>;
  shared?: boolean;
}) {
  const [image, setImage] = useState(""),
    [offsetX, setX] = useState(0),
    [offsetY, setY] = useState(0),
    [zoom, setZoom] = useState(1),
    [busy, setBusy] = useState(false),
    [treating, setTreating] = useState(false),
    [origin, setOrigin] = useState<"photograph" | "generated">("photograph");
  const original = useRef<HTMLImageElement | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (confirmation.current) confirmation.current.checked = false;
  }, [image]);
  useEffect(() => {
    if (!image || !original.current || !preview.current) return;
    const img = original.current,
      c = preview.current,
      ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 800, 800);
    ctx.save();
    const scale = (800 / Math.min(img.width, img.height)) * zoom;
    ctx.beginPath();
    ctx.arc(400, 400, 400, 0, 2 * Math.PI);
    ctx.clip();
    ctx.drawImage(
      img,
      400 - (img.width * scale) / 2 + offsetX * 8,
      400 - (img.height * scale) / 2 + offsetY * 8,
      img.width * scale,
      img.height * scale,
    );
    ctx.restore();
  }, [image, zoom, offsetX, offsetY]);
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image);
    },
    [image],
  );
  const [metadata, setMetadata] = useState({
    model: -1,
    finish: 1,
    size: 18,
    kind: "rim" as "rim" | "assembly",
  });
  async function select(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 20000000
    )
      return notify("Use uma foto JPEG, PNG ou WebP de até 20 MB.");
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      original.current = img;
      setImage(url);
      setOrigin("photograph");
      setZoom(1);
      setX(0);
      setY(0);
    } catch {
      URL.revokeObjectURL(url);
      notify("Não foi possível ler a fotografia.");
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!original.current)
      return notify("Selecione uma fotografia frontal do produto.");
    setBusy(true);
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      const result = preview.current!.toDataURL("image/webp", 0.9);
      if (result.length > 900000)
        throw Error("Imagem muito pesada. Escolha uma foto menor.");
      await onSave({
        ...metadata,
        image: result,
        source: String(data.source),
        credit: String(data.credit),
        name: String(data.name),
        origin,
      });
      notify(
        shared
          ? "Imagem adicionada ao catálogo compartilhado."
          : "Imagem salva no seu catálogo. O administrador pode publicá-la para todos.",
      );
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="photo-upload"
      onSubmit={submit}
      aria-busy={busy || treating}
    >
      <fieldset disabled={busy || treating}>
        <div className="section-title">
          <div>
            <h2>
              <Camera size={22} /> Catálogo fotográfico real
            </h2>
            <p>
              Cadastre fotos frontais dos fabricantes. Com foto apenas do aro, o
              pneu real da foto do carro é preservado. Com conjunto completo,
              roda e pneu vêm da fotografia cadastrada.
            </p>
          </div>
        </div>
        <p>
          {shared
            ? "A imagem será publicada no catálogo compartilhado."
            : "Seus envios ficam no seu catálogo e podem ser aprovados pelo administrador para uso compartilhado."}
        </p>
        <label>
          Nome da roda
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Ex.: Minha roda esportiva"
          />
        </label>
        <label>
          Conteúdo da fotografia
          <select
            value={metadata.kind}
            onChange={(e) =>
              setMetadata({
                ...metadata,
                kind: e.target.value as "rim" | "assembly",
              })
            }
          >
            <option value="rim">
              Somente roda — preservar pneu real do carro
            </option>
            <option value="assembly">
              Roda + pneu — fotografia do conjunto completo
            </option>
          </select>
        </label>
        <div className="photo-metadata">
          <label>
            Modelo
            <select
              aria-label="Modelo da fotografia"
              value={metadata.model}
              onChange={(e) =>
                setMetadata({ ...metadata, model: Number(e.target.value) })
              }
            >
              <option value={-1}>Novo modelo enviado</option>
              {shared &&
                models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Acabamento fotografado
            <select
              value={metadata.finish}
              onChange={(e) =>
                setMetadata({ ...metadata, finish: Number(e.target.value) })
              }
            >
              {finishes.map(([n], i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Aro da fotografia
            <select
              value={metadata.size}
              onChange={(e) =>
                setMetadata({ ...metadata, size: Number(e.target.value) })
              }
            >
              {Array.from({ length: 9 }, (_, i) => (
                <option key={i} value={i + 14}>
                  {i + 14}”
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="file-label">
          <Upload size={20} /> Selecionar fotografia real
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => select(e.target.files?.[0])}
            required
          />
        </label>
        {image && (
          <div className="ai-treatment">
            <button
              type="button"
              className="dark-button"
              disabled={treating || !onTreat}
              onClick={async () => {
                if (!onTreat || !preview.current) return;
                setTreating(true);
                try {
                  const result = await onTreat(
                    preview.current.toDataURL("image/webp", 0.88),
                    metadata.kind,
                  );
                  const img = new Image();
                  img.src = result;
                  await img.decode();
                  original.current = img;
                  setImage(result);
                  setOrigin("generated");
                  setZoom(1);
                  setX(0);
                  setY(0);
                  notify(
                    "Tratamento concluído. Confira a prévia antes de salvar.",
                  );
                } catch (e: any) {
                  notify(e.message);
                } finally {
                  setTreating(false);
                }
              }}
            >
              {treating ? "Tratando imagem…" : "Tratar foto com IA"}
            </button>
            <p>
              {origin === "generated"
                ? "Imagem tratada por IA. Confira o desenho e o acabamento."
                : "Envie uma foto frontal de uma única roda. Você pode usar o enquadramento manual ou pedir o tratamento por IA."}
            </p>
          </div>
        )}
        {image && (
          <div className="crop-workspace">
            <div className="photo-crop">
              <canvas
                ref={preview}
                width={800}
                height={800}
                aria-label="Enquadramento da fotografia real"
              />
              <span />
            </div>
            <div>
              <p>
                A borda circular deve acompanhar o contorno externo da roda ou
                do conjunto fotografado. Use somente fotos frontais; o
                aplicativo não achata rodas em perspectiva.
              </p>
              <label>
                Ampliação
                <input
                  type="range"
                  min=".5"
                  max="3"
                  step=".01"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
              <label>
                Centralizar horizontalmente
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step=".1"
                  value={offsetX}
                  onChange={(e) => setX(Number(e.target.value))}
                />
              </label>
              <label>
                Centralizar verticalmente
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step=".1"
                  value={offsetY}
                  onChange={(e) => setY(Number(e.target.value))}
                />
              </label>
            </div>
          </div>
        )}
        <div className="photo-metadata">
          <label>
            Link da fonte
            <input
              name="source"
              type="url"
              placeholder="https://fabricante.com/produto (opcional)"
              maxLength={1000}
            />
          </label>
          <label>
            Crédito / origem
            <input
              name="credit"
              maxLength={200}
              placeholder="Fabricante ou fotógrafo"
            />
          </label>
        </div>
        <label className="photo-confirm">
          <input ref={confirmation} type="checkbox" required />
          <span>
            Conferi que a foto mostra o modelo, aro e acabamento cadastrados,
            sem perspectiva e com o contorno inteiro, e revisei qualquer
            tratamento por IA.
          </span>
        </label>
        <button className="primary" disabled={busy || treating}>
          <Check size={17} />
          {busy ? "Salvando…" : "Salvar imagem no catálogo"}
        </button>
      </fieldset>
    </form>
  );
}
