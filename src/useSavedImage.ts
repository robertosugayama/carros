import { useEffect, useState } from "react";
import { canvasImageSource } from "./imageSource";
export function useSavedImage(source: string, attempt = 0) {
  const [value, setValue] = useState({
    source: "",
    src: "",
    width: 0,
    height: 0,
    error: "",
  });
  useEffect(() => {
    let cancelled = false;
    setValue({ source, src: "", width: 0, height: 0, error: "" });
    if (!source) {
      setValue({ source: "", src: "", width: 0, height: 0, error: "" });
      return;
    }
    (async () => {
      try {
        const src = await canvasImageSource(source),
          img = new Image();
        img.src = src;
        await img.decode();
        if (!cancelled)
          setValue({
            source,
            src,
            width: img.naturalWidth,
            height: img.naturalHeight,
            error: "",
          });
      } catch {
        if (!cancelled)
          setValue({
            source,
            src: "",
            width: 0,
            height: 0,
            error:
              "Não foi possível carregar a foto do carro. Tente abrir novamente ou troque a foto.",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, attempt]);
  return value.source === source
    ? value
    : { source, src: "", width: 0, height: 0, error: "" };
}
