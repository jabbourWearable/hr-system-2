export const KUDOS_CATEGORIES = [
  "Team player",
  "Above & beyond",
  "Great idea",
  "Helping hand",
  "Customer hero",
] as const;

export type KudosCategory = (typeof KUDOS_CATEGORIES)[number];
