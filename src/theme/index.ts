import colors from "./colors";
import typography from "./typography";
import spacing from "./spacing";
import borderRadius from "./borderRadius";
import shadows from "./shadows";

export { colors, typography, spacing, borderRadius, shadows };

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
} as const;

export default theme;
