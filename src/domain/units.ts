export const METERS_PER_YARD = 0.9144;
export const yardsToMeters = (yards: number): number => Math.round(yards * METERS_PER_YARD);
