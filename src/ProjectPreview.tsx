import Wheel from "./Wheel";
import { useSavedImage } from "./useSavedImage";
import type { Placement } from "./catalog";
export default function ProjectPreview({
  payload,
  name,
  onOpen,
}: {
  payload: any;
  name: string;
  onOpen: () => void;
}) {
  const image = useSavedImage(payload.image);
  return (
    <button
      type="button"
      className="project-thumb"
      aria-label={"Visualizar " + name}
      onClick={onOpen}
      style={{ aspectRatio: image.width ? image.width / image.height : 16 / 9 }}
    >
      {image.src ? (
        <>
          <img src={image.src} alt={name} />
          {payload.showWheels !== false &&
            payload.wheels.map((w: Placement, i: number) => (
              <div
                key={i}
                style={{
                  left: `${w.x * 100}%`,
                  top: `${w.y * 100}%`,
                  width: `${w.diameter * 100}%`,
                }}
              >
                <Wheel {...payload} mounted />
              </div>
            ))}
        </>
      ) : (
        <span>{image.error || "Carregando foto…"}</span>
      )}
    </button>
  );
}
