import { createContext, useContext } from "react";
export type WheelPhoto = {
  id: number;
  model: number;
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
  model: number,
  finish: number,
  size: number,
) {
  return photos.find(
    (p) => p.model === model && p.finish === finish && p.size === size,
  );
}
