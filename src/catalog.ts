export const models = [
  ["MKR Beadlock", "Off-Road 4×4 · 17/20", "star", 8, 6],
  ["VOSSEN Mesh", "Off-Road · 20", "mesh", 10, 6],
  ["Frontier CNC", "Diamantada · 6×114", "split", 6, 6],
  ["ZW002", "Gloss Black Concave", "blade", 5, 5],
  ["Tarântula Sport", "Blade Fan · 15/17", "turbine", 10, 5],
  ["MKR Anel Prata", "Off-Road Star", "star", 6, 6],
  ["Vossen Heavy Duty", "Truck 4×4 · Tala larga", "split", 8, 6],
  ["Texas M31 Triton", "Bronze Khaki", "star", 8, 6],
  ["Spiderweb", "Chrome & Black Mesh", "mesh", 16, 5],
  ["Hilux / Ranger", "Dark Graphite · 6-Lug", "split", 6, 6],
  ["TIS Deep Dish", "O-F-F-R-O-A-D", "star", 8, 8],
  ["Dual Turbine", "Machined Truck", "turbine", 12, 6],
  ["MKR Heavy Duty", "Black · 8-Lug", "star", 8, 8],
  ["BBS Super RS", "Y-Mesh Forged", "mesh", 14, 5],
  ["Volk TE37", "Forged JDM", "solid", 6, 5],
  ["RS / GT OEM", "Replica · Diamantada", "split", 5, 5],
  ["Vossen CVT", "Directional Sport", "turbine", 10, 5],
  ["Vossen Split-5", "Concave Luxury", "split", 5, 5],
].map(([name, subtitle, design, spokes, lugs], id) => ({
  id,
  name: String(name),
  subtitle: String(subtitle),
  design: String(design),
  spokes: Number(spokes),
  lugs: Number(lugs),
}));
export const finishes = [
  ["Cromada", "#dce6eb"],
  ["Prata Satin", "#aeb7bc"],
  ["Grafite Titânio", "#697780"],
  ["Antracite", "#41474c"],
  ["Ouro Champagne", "#c6aa73"],
  ["Black Piano", "#161a20"],
  ["Preto Fosco", "#292c30"],
];
export const calipers = [
  ["Dourada", "#d7ac38"],
  ["Preta", "#202327"],
  ["Prata", "#b5bdc7"],
  ["Amarela", "#ffda32"],
  ["Vermelha", "#ed383a"],
  ["Azul", "#2585e8"],
  ["Verde", "#51d47a"],
  ["Rosa", "#ed66ad"],
  ["Roxa", "#9552da"],
  ["Black Piano", "#0e1015"],
  ["Cinza Alumínio", "#808c96"],
];
export type Placement = { x: number; y: number; diameter: number };
export const defaultWheels: Placement[] = [
  { x: 0.265, y: 0.69, diameter: 0.16 },
  { x: 0.76, y: 0.69, diameter: 0.16 },
];
export function rimRatio(size: number) {
  return 0.59 + (size - 14) * 0.035;
}
export function validPlacement(w: Placement) {
  return (
    [w.x, w.y, w.diameter].every(Number.isFinite) &&
    w.x >= 0 &&
    w.x <= 1 &&
    w.y >= 0 &&
    w.y <= 1 &&
    w.diameter >= 0.03 &&
    w.diameter <= 0.65
  );
}
