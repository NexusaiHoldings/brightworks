/**
 * active-theme — the resolved ThemeContract this company wears.
 * Written by provisioning (_step_substrate_install): an approved mood
 * board's derived theme wins, else the CMO's authored ThemeContract
 * (company-theme-authoring-001 / visual phase 3b). Do NOT hand-edit.
 */
import type { ThemeContract } from "./contract";

export const activeTheme: ThemeContract = {
  "type": {
    "fontBody": "inter",
    "fontHeading": "space-grotesk"
  },
  "color": {
    "bg": "#0f1a12",
    "text": "#f0ede6",
    "accent": "#e8a020",
    "border": "#2e4233",
    "danger": "#d94f3d",
    "success": "#4caf72",
    "surface": "#1a2b1e",
    "textMuted": "#a8b8a2",
    "accentText": "#0f1a12",
    "surfaceAlt": "#243628",
    "borderStrong": "#3d5944"
  },
  "shape": {
    "radius": 6
  }
};
