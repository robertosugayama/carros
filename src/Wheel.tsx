import { useId, useState, useEffect } from "react";
import { wheelImage, type DiscStyle } from "./brakeImages";
import { models, finishes, rimRatio } from "./catalog";
import { findPhoto, usePhotoCatalog, type WheelPhoto } from "./PhotoCatalog";
export default function Wheel({
  model = 0,
  finish = 0,
  size = 18,
  photo,
  mounted = false,
  caliper,
  discStyle = "drilled",
}: {
  model?: number | string;
  finish?: number;
  size?: number;
  photo?: WheelPhoto;
  mounted?: boolean;
  discStyle?: DiscStyle;
  caliper?: number;
  angle?: number;
}) {
  const photos = usePhotoCatalog();
  const asset = photo || findPhoto(photos, model, finish, size);
  const [rendered, setRendered] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!asset) {
      setRendered("");
      return;
    }
    setRendered("");
    wheelImage(asset, caliper, discStyle)
      .then((value) => {
        if (!cancelled) setRendered(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [asset, caliper, discStyle]);
  const id = useId().replace(/:/g, "");
  const ratio = mounted && asset?.kind === "rim" ? rimRatio(size) : 1;
  const edge = (1000 - 1000 * ratio) / 2;
  if (!asset)
    return (
      <span
        className="photo-pending"
        aria-label="Fotografia real ainda não cadastrada"
      >
        Foto real
        <br />
        pendente
      </span>
    );
  return (
    <svg
      viewBox="0 0 1000 1000"
      role="img"
      aria-label={`${asset.origin === "generated" ? "Imagem gerada por IA de" : "Fotografia de"} ${asset.name || (typeof model === "number" ? models[model]?.name : undefined) || "Roda enviada"}, aro ${size}, ${finishes[finish]?.[0]}`}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <clipPath id={id}>
          <circle cx="500" cy="500" r={499 * ratio} />
        </clipPath>
      </defs>
      <image
        href={rendered || asset.image}
        x={edge}
        y={edge}
        width={1000 * ratio}
        height={1000 * ratio}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${id})`}
      />
    </svg>
  );
}
