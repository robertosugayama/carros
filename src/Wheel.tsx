import { useId } from "react";
import { models, finishes, rimRatio } from "./catalog";
import { findPhoto, usePhotoCatalog, type WheelPhoto } from "./PhotoCatalog";
export default function Wheel({
  model = 0,
  finish = 0,
  size = 18,
  photo,
  mounted = false,
}: {
  model?: number;
  finish?: number;
  size?: number;
  photo?: WheelPhoto;
  mounted?: boolean;
  caliper?: number;
  angle?: number;
}) {
  const photos = usePhotoCatalog();
  const asset = photo || findPhoto(photos, model, finish, size);
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
      aria-label={`Fotografia de ${models[model]?.name}, aro ${size}, ${finishes[finish]?.[0]}`}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <clipPath id={id}>
          <circle cx="500" cy="500" r={499 * ratio} />
        </clipPath>
      </defs>
      <image
        href={asset.image}
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
