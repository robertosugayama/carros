import { useEffect, useRef, useState } from "react";
import { Camera, Check, Upload, LoaderCircle } from "lucide-react";
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
  const [image, setImage] = useState("");
  const [original, setOriginal] = useState("");
  const [busy, setBusy] = useState(false);
  const [treating, setTreating] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );

  async function prepare(source: string, request: number) {
    setTreating(true);
    setImage("");
    setError("");
    try {
      if (!onTreat)
        throw Error(
          "O tratamento por IA não está disponível. Tente novamente mais tarde.",
        );
      const result = await onTreat(source, "rim");
      const check = new Image();
      check.src = result;
      await check.decode();
      if (revision.current === request) setImage(result);
    } catch (cause: any) {
      if (revision.current === request)
        setError(
          cause.message || "Não foi possível preparar a foto. Tente novamente.",
        );
    } finally {
      if (revision.current === request) setTreating(false);
    }
  }

  async function select(file?: File) {
    if (!file) return;
    const request = ++revision.current;
    setImage("");
    setOriginal("");
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 20000000
    ) {
      setError("Use uma foto JPEG, PNG ou WebP de até 20 MB.");
      return;
    }
    setTreating(true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (revision.current !== request) return;
      // Preserve the whole photograph for perspective correction; never clip before AI.
      const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas
        .getContext("2d")!
        .drawImage(img, 0, 0, canvas.width, canvas.height);
      const source = canvas.toDataURL("image/webp", 0.9);
      if (source.length > 3500000)
        throw Error("A foto está muito pesada. Envie um arquivo menor.");
      setOriginal(source);
      await prepare(source, request);
    } catch (cause: any) {
      if (revision.current === request) {
        setError(cause.message || "Não foi possível ler a foto.");
        setTreating(false);
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image || treating || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      await onSave({
        name: String(data.get("name")).trim(),
        // Existing credit field stores the manufacturer, preserving deployed rules.
        credit: String(data.get("manufacturer")).trim(),
        size: Number(data.get("size")),
        model: -1,
        finish: 1,
        kind: "rim",
        source: "",
        origin: "generated",
        image,
      });
      setImage("");
      setOriginal("");
      form.reset();
      notify(
        shared
          ? "Roda adicionada ao catálogo compartilhado."
          : "Roda salva no seu catálogo. O administrador pode publicá-la para todos.",
      );
    } catch (cause: any) {
      notify(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="photo-upload compact-photo-upload"
      onSubmit={submit}
      aria-busy={busy || treating}
    >
      <fieldset disabled={busy || treating}>
        <div className="section-title">
          <div>
            <h2>
              <Camera size={22} /> Adicionar roda
            </h2>
            <p>
              A IA remove o fundo, centraliza a roda e corrige a perspectiva
              automaticamente. O pneu e os freios serão adicionados na montagem.
            </p>
          </div>
        </div>
        <label>
          Nome da roda
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Ex.: Sport 5"
          />
        </label>
        <div className="wheel-upload-fields">
          <label>
            Nome do fabricante
            <input
              name="manufacturer"
              required
              maxLength={200}
              placeholder="Ex.: fabricante da roda"
            />
          </label>
          <label>
            Tamanho do aro
            <select name="size" defaultValue="18">
              {Array.from({ length: 9 }, (_, i) => (
                <option key={i} value={i + 14}>
                  {i + 14}”
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="file-label">
          <Upload size={20} />{" "}
          {original ? "Trocar foto" : "Selecionar foto da roda"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              void select(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {(treating || image || error) && (
          <div className="wheel-auto-preview" aria-live="polite">
            {treating && (
              <p role="status">
                <LoaderCircle className="wheel-upload-spinner" size={20} />{" "}
                Preparando sua roda com IA…
              </p>
            )}
            {image && (
              <>
                <img src={image} alt="Roda preparada por IA para o catálogo" />
                <p>
                  <Check size={16} /> Pronta para inserir · imagem tratada por
                  IA
                </p>
              </>
            )}
            {error && (
              <>
                <p role="alert">{error}</p>
                {original && (
                  <button
                    type="button"
                    className="light-button"
                    onClick={() => prepare(original, ++revision.current)}
                  >
                    Tentar novamente
                  </button>
                )}
              </>
            )}
          </div>
        )}
        <button className="primary" disabled={!image || busy || treating}>
          <Check size={17} />
          {busy ? "Salvando…" : "Salvar roda no catálogo"}
        </button>
      </fieldset>
    </form>
  );
}
