// Specter Design System - Component Specifications
// Comprehensive styling specifications for core UI components

import { colors } from "./colors";
import { typography } from "./typography";
import { spacing } from "./spacing";
import { borderRadius } from "./borderRadius";
import { shadows } from "./shadows";

// ============================================================================
// BUTTON COMPONENT SPECIFICATIONS
// ============================================================================

export const buttonSpecs = {
  variants: {
    primary: {
      backgroundColor: colors.primary,
      color: colors.primaryForeground,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      shadow: shadows.md,
      minHeight: 48,
      minWidth: 120,
      states: {
        hover: {
          backgroundColor: colors.primaryDark,
          shadow: shadows.lg,
        },
        pressed: {
          backgroundColor: colors.primaryDark,
          shadow: shadows.sm,
        },
        disabled: {
          backgroundColor: colors.gray[400],
          color: colors.gray[600],
          shadow: {},
        },
      },
    },

    secondary: {
      backgroundColor: colors.muted.bg,
      color: colors.foreground,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      shadow: shadows.sm,
      minHeight: 48,
      states: {
        hover: {
          backgroundColor: colors.gray[100],
          shadow: shadows.md,
        },
        pressed: {
          backgroundColor: colors.gray[200],
          shadow: shadows.sm,
        },
        disabled: {
          backgroundColor: colors.gray[50],
          color: colors.gray[400],
          shadow: {},
        },
      },
    },

    outline: {
      backgroundColor: "transparent",
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      shadow: shadows.sm,
      minHeight: 48,
      states: {
        hover: {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.primary,
          shadow: shadows.md,
        },
        pressed: {
          backgroundColor: colors.gray[100],
          borderColor: colors.primaryDark,
          shadow: shadows.sm,
        },
        disabled: {
          borderColor: colors.gray[300],
          color: colors.gray[400],
          shadow: {},
        },
      },
    },

    ghost: {
      backgroundColor: "transparent",
      color: colors.foreground,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      minHeight: 48,
      states: {
        hover: {
          backgroundColor: colors.gray[50],
        },
        pressed: {
          backgroundColor: colors.gray[100],
        },
        disabled: {
          color: colors.gray[400],
        },
      },
    },

    destructive: {
      backgroundColor: colors.destructive,
      color: colors.destructiveForeground,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      shadow: shadows.md,
      minHeight: 48,
      states: {
        hover: {
          backgroundColor: colors.destructive,
          opacity: 0.9,
          shadow: shadows.lg,
        },
        pressed: {
          backgroundColor: colors.destructive,
          opacity: 0.8,
          shadow: shadows.sm,
        },
        disabled: {
          backgroundColor: colors.gray[400],
          color: colors.gray[600],
          shadow: {},
        },
      },
    },
  },

  sizes: {
    sm: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: typography.fontSize.xs,
      minHeight: 36,
    },
    md: {
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.sm,
      minHeight: 48,
    },
    lg: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.base,
      fontSize: typography.fontSize.base,
      minHeight: 56,
    },
  },
};

// ============================================================================
// CARD COMPONENT SPECIFICATIONS
// ============================================================================

export const cardSpecs = {
  variants: {
    default: {
      backgroundColor: colors.card.bg,
      borderColor: colors.card.border,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      shadow: shadows.md,
      states: {
        hover: {
          shadow: shadows.lg,
          borderColor: colors.primary,
        },
        pressed: {
          shadow: shadows.sm,
          backgroundColor: colors.card.bg,
        },
      },
    },

    plain: {
      backgroundColor: colors.card.bg,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      shadow: shadows.sm,
    },

    elevated: {
      backgroundColor: colors.card.bg,
      borderColor: colors.card.border,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      shadow: shadows.lg,
    },
  },

  sections: {
    header: {
      marginBottom: spacing.sm,
    },
    content: {
      gap: spacing.sm,
    },
    actions: {
      marginTop: spacing.xl,
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.sm,
    },
  },
};

// ============================================================================
// INPUT COMPONENT SPECIFICATIONS
// ============================================================================

export const inputSpecs = {
  variants: {
    default: {
      backgroundColor: colors.card.bg,
      borderColor: colors.input,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2, // 10px
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.normal,
      color: colors.foreground,
      placeholderColor: colors.foregroundMuted,
      minHeight: 40,
      shadow: shadows.sm,
      states: {
        focus: {
          borderColor: colors.primary,
          shadow: shadows.md,
        },
        error: {
          borderColor: colors.destructive,
          shadow: shadows.sm,
        },
        disabled: {
          backgroundColor: colors.gray[50],
          color: colors.gray[400],
          borderColor: colors.gray[200],
        },
      },
    },

    filled: {
      backgroundColor: colors.gray[50],
      borderColor: "transparent",
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      fontSize: typography.fontSize.sm,
      color: colors.foreground,
      placeholderColor: colors.foregroundMuted,
      minHeight: 40,
      states: {
        focus: {
          backgroundColor: colors.card.bg,
          borderColor: colors.primary,
          shadow: shadows.sm,
        },
        error: {
          backgroundColor: colors.card.bg,
          borderColor: colors.destructive,
        },
        disabled: {
          backgroundColor: colors.gray[25],
          color: colors.gray[400],
        },
      },
    },
  },

  sizes: {
    sm: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: typography.fontSize.xs,
      minHeight: 32,
    },
    md: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      fontSize: typography.fontSize.sm,
      minHeight: 40,
    },
    lg: {
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.base,
      minHeight: 48,
    },
  },
};

// ============================================================================
// BADGE COMPONENT SPECIFICATIONS
// ============================================================================

export const badgeSpecs = {
  variants: {
    default: {
      backgroundColor: colors.primary,
      color: colors.primaryForeground,
      borderRadius: borderRadius["2xl"],
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
      minHeight: 20,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    secondary: {
      backgroundColor: colors.muted.bg,
      color: colors.foreground,
      borderRadius: borderRadius["2xl"],
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      minHeight: 20,
    },

    outline: {
      backgroundColor: "transparent",
      color: colors.foreground,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: borderRadius["2xl"],
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      minHeight: 20,
    },

    destructive: {
      backgroundColor: colors.destructive,
      color: colors.destructiveForeground,
      borderRadius: borderRadius["2xl"],
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
      minHeight: 20,
    },

    success: {
      backgroundColor: colors.success,
      color: colors.white,
      borderRadius: borderRadius["2xl"],
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
      minHeight: 20,
    },
  },

  sizes: {
    sm: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs / 2,
      fontSize: typography.fontSize["2xs"],
      minHeight: 16,
    },
    md: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: typography.fontSize.xs,
      minHeight: 20,
    },
    lg: {
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize.sm,
      minHeight: 24,
    },
  },
};

// ============================================================================
// AVATAR COMPONENT SPECIFICATIONS
// ============================================================================

export const avatarSpecs = {
  variants: {
    circle: {
      borderRadius: borderRadius.full,
      backgroundColor: colors.muted.bg,
      borderWidth: 0,
    },

    square: {
      borderRadius: borderRadius.md,
      backgroundColor: colors.muted.bg,
      borderWidth: 0,
    },

    withBorder: {
      borderRadius: borderRadius.full,
      backgroundColor: colors.muted.bg,
      borderWidth: 2,
      borderColor: colors.border,
    },
  },

  sizes: {
    xs: {
      width: 24,
      height: 24,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
    sm: {
      width: 32,
      height: 32,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
    },
    md: {
      width: 40,
      height: 40,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
    },
    lg: {
      width: 56,
      height: 56,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
    },
    xl: {
      width: 72,
      height: 72,
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
    },
  },

  fallback: {
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
    textAlign: "center",
    textAlignVertical: "center",
  },
};

// ============================================================================
// BOTTOM NAVIGATION SPECIFICATIONS
// ============================================================================

export const bottomNavSpecs = {
  container: {
    backgroundColor: colors.card.bg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 52,
    paddingBottom: 0, // Safe area handled separately
    paddingTop: 6,
    shadow: shadows.sm,
  },

  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: 4,
    states: {
      active: {
        color: colors.primary,
      },
      inactive: {
        color: colors.foregroundMuted,
      },
    },
  },

  label: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
    marginTop: 2,
    states: {
      active: {
        color: colors.primary,
      },
      inactive: {
        color: colors.foregroundMuted,
      },
    },
  },

  icon: {
    size: 22,
    states: {
      active: {
        color: colors.primary,
      },
      inactive: {
        color: colors.foregroundMuted,
      },
    },
  },
};

// ============================================================================
// COMPONENT IMPLEMENTATION NOTES
// ============================================================================

/*
Component Implementation Guidelines:

1. All interactive elements must have minimum 44x44px touch targets
2. Use consistent border radius values from borderRadius system
3. Apply appropriate shadows from shadows system
4. Follow spacing scale for padding and margins
5. Use typography system for font sizes and weights
6. Support all documented states (hover, pressed, disabled, focus, error)
7. Ensure accessibility with proper contrast ratios
8. Test on both iOS and Android for consistency
9. Support dynamic theming through color system
10. Include proper loading states and error handling

Color Usage Priority:
1. Use semantic colors (primary, destructive, success, etc.) for consistency
2. Use foreground/background for text and surfaces
3. Use gray scale for subtle variations
4. Reserve brand colors for accents and highlights

Animation Guidelines:
- Button press: 150ms opacity change
- Hover states: 200ms transition
- Loading states: Smooth spinner animation
- Navigation transitions: 300ms slide animations
*/

export default {
  buttonSpecs,
  cardSpecs,
  inputSpecs,
  badgeSpecs,
  avatarSpecs,
  bottomNavSpecs,
};