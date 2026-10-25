import { memo, useId, useState, useEffect } from "react";
import { type DiscStyle } from "./brakeImages";
import { models, finishes } from "./catalog";
import { assembledWheelImage } from "./wheelAssembly";
import { type TyreProfile } from "./tyres";
import { findPhoto, usePhotoCatalog, type WheelPhoto } from "./PhotoCatalog";
function Wheel({
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
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setError("");
    if (!asset) {
      setRendered("");
      return;
    }
    setRendered("");
    assembledWheelImage(asset, size, tyreProfile, caliper, discStyle)
      .then((value) => {
        if (!cancelled) setRendered(value);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(cause.message || "Não foi possível carregar a roda.");
      });
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
      aria-busy={!rendered && !error}
      data-load-state={error ? "error" : rendered ? "ready" : "loading"}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      {!error && !rendered && (
        <text x="500" y="480" textAnchor="middle" fontSize="65" fill="#536345">
          Carregando…
        </text>
      )}
      {error && (
        <>
          <title>{error}</title>
          <text
            x="500"
            y="480"
            textAnchor="middle"
            fontSize="65"
            fill="#91452d"
          >
            Imagem indisponível
          </text>
        </>
      )}
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

export default memo(Wheel);
