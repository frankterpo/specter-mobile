// Specter Design System - Main Export
export { colors, getTagColor, getHighlightColor } from "./colors";
export { spacing, borderRadius, shadows, typography } from "./tokens";

// Re-export everything
import colors from "./colors";
import * as tokens from "./tokens";

export const theme = {
  colors,
  ...tokens,
} as const;

export default theme;

