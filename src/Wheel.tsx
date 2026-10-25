import { useId, useState, useEffect } from "react";
import { type DiscStyle } from "./brakeImages";
import { models, finishes } from "./catalog";
import { assembledWheelImage } from "./wheelAssembly";
import { type TyreProfile } from "./tyres";
import { findPhoto, usePhotoCatalog, type WheelPhoto } from "./PhotoCatalog";
export default function Wheel({
  model = 0,
  finish = 0,
  size = 18,
  photo,
  tyreProfile = "medium",
  caliper,
  discStyle = "drilled",
}: {
  model?: number | string;
  finish?: number;
  size?: number;
  photo?: WheelPhoto;
  mounted?: boolean;
  tyreProfile?: TyreProfile;
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
    assembledWheelImage(asset, size, tyreProfile, caliper, discStyle)
      .then((value) => {
        if (!cancelled) setRendered(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [asset, caliper, discStyle, size, tyreProfile]);
  const id = useId().replace(/:/g, "");

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
      data-tyre-profile={tyreProfile}
      data-rim-size={size}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <clipPath id={id}>
          <circle cx="500" cy="500" r={499} />
        </clipPath>
      </defs>
      <image
        href={rendered || undefined}
        x={0}
        y={0}
        width={1000}
        height={1000}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${id})`}
      />
    </svg>
  );
}
