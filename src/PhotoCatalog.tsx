import { createContext, useContext } from "react";
export type WheelPhoto = {
  name?: string;
  owner_id?: string | number;
  public?: boolean;
  solidImage?: string;
  caliperHue?: number;
  discStyle?: "drilled" | "solid";
  origin?: "generated" | "photograph";
  id: number | string;
  model: number | string;
  finish: number;
  size: number;
  image: string;
  source: string;
  credit: string;
  kind?: "rim" | "assembly";
};
export const PhotoCatalog = createContext<WheelPhoto[]>([]);
export const usePhotoCatalog = () => useContext(PhotoCatalog);
export function findPhoto(
  photos: WheelPhoto[],
  model: number | string,
  finish: number,
  size: number,
) {
  return photos.find(
    (p) => p.model === model && p.finish === finish && p.size === size,
  );
}
