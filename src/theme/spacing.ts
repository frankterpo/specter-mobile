// Specter Design System - Spacing
// 4px increment scale with standard padding values

export const spacing = {
  xs: 4,    // 4px - Tight spacing
  sm: 8,    // 8px - Small gaps
  md: 12,   // 12px - Medium gaps
  base: 16, // 16px - Base spacing
  lg: 20,   // 20px - Large gaps (screen padding)
  xl: 24,   // 24px - Extra large (card padding)
  "2xl": 32, // 32px - Section spacing
  "3xl": 40, // 40px - Large sections
} as const;

// Standard Padding Values
//
// Screen horizontal: `20px` (lg)
// Card padding: `24px` (xl)
// Button padding: `8px 16px` (sm/base) or `8px 24px` (sm/xl) for large
// Input padding: `10px 12px` or `8px 16px`

// Component-specific spacing
export const componentSpacing = {
  // Screen layouts
  screenHorizontal: spacing.lg,     // 20px
  screenVertical: spacing.xl,       // 24px

  // Cards
  cardPadding: spacing.xl,          // 24px
  cardGap: spacing.sm,              // 8px between sections

  // Buttons
  buttonPaddingHorizontal: spacing.base, // 16px
  buttonPaddingVertical: spacing.sm,     // 8px
  buttonLargePaddingHorizontal: spacing.xl, // 24px

  // Inputs
  inputPaddingHorizontal: spacing.md,    // 12px
  inputPaddingVertical: spacing.xs + 2,  // 10px (approximately)
  inputGroupMargin: spacing.base,        // 16px between input groups

  // Icons
  iconSize: {
    small: 16,
    medium: 20,
    large: 24,
    xl: 32,
  },

  // Borders
  borderWidth: {
    thin: 1,
    medium: 2,
    thick: 3,
  },

  // Touch targets (minimum 44x44px)
  touchTarget: {
    minWidth: 44,
    minHeight: 44,
  },

  // List items
  listItemGap: spacing.sm,          // 8px between list items
  listItemPadding: spacing.sm,      // 8px padding for list items

  // Navigation
  tabBarHeight: 52,                 // Tab bar height (with safe area)
  headerHeight: 56,                 // Standard header height

  // Modals/Dialogs
  modalPadding: spacing.xl,         // 24px
  modalBorderRadius: 12,

  // Forms
  formFieldGap: spacing.sm,         // 8px between form fields
  formSectionGap: spacing.xl,       // 24px between form sections

  // Typography spacing
  textLineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Animations
  animationDuration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
} as const;

export default spacing;