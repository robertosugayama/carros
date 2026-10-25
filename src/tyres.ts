export const tyreProfiles = [
  { id: "low", name: "Baixo", aspect: 35 },
  { id: "medium", name: "Médio", aspect: 50 },
  { id: "high", name: "Alto", aspect: 65 },
] as const;
export type TyreProfile = (typeof tyreProfiles)[number]["id"];
export function validTyreProfile(value: unknown): TyreProfile {
  return tyreProfiles.some((p) => p.id === value)
    ? (value as TyreProfile)
    : "medium";
}
export function outerDiameterMm(size: number, profile: TyreProfile) {
  const aspect = tyreProfiles.find((p) => p.id === profile)?.aspect || 50;
  return size * 25.4 + (2 * 225 * aspect) / 100;
}
export function tyreRimRatio(size: number, profile: TyreProfile) {
  return (size * 25.4) / outerDiameterMm(size, profile);
}
// A 280 mm road-car rotor, independent of visual fitting zoom.
export function brakeRimRatio(size: number) {
  return Math.max(0.48, Math.min(0.79, 280 / (size * 25.4)));
}
