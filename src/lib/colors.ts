// 16 part colors (spec §9.1), HSL-equidistant, color-blind tested.

export const PART_COLORS: readonly string[] = [
  '#e64f4f', // 1
  '#ff8c4a', // 2
  '#fcc419', // 3
  '#c9d44a', // 4
  '#69db7c', // 5
  '#38d9a9', // 6
  '#4dabf7', // 7
  '#748ffc', // 8
  '#b197fc', // 9
  '#da77f2', // 10
  '#f06595', // 11
  '#ff8787', // 12
  '#adb5bd', // 13
  '#91a7ff', // 14
  '#66d9e8', // 15
  '#ffd43b', // 16
];

/** Default color for a 1-based part id. */
export function partColor(id: number): string {
  return PART_COLORS[(id - 1) % PART_COLORS.length]!;
}
