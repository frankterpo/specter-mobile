/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

module.exports = {
  content: ["./App.tsx", "./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  corePlugins: {
    space: false,
  },
  theme: {
    extend: {
      // Specter Brand Colors (from app.tryspecter.com)
      colors: {
        // Sidebar/Navigation - Dark Navy
        sidebar: {
          DEFAULT: "#0f172a",
          dark: "#0a0f1a",
          light: "#1e293b",
          border: "#1e293b",
        },
        // Primary brand
        specter: {
          green: "#22c55e",
          "green-light": "#4ade80",
          "green-dark": "#16a34a",
          blue: "#3b82f6",
          "blue-light": "#60a5fa",
          "blue-dark": "#2563eb",
          purple: "#8b5cf6",
          "purple-light": "#a78bfa",
        },
        // Content area
        content: {
          bg: "#ffffff",
          "bg-secondary": "#f8fafc",
          border: "#e2e8f0",
        },
        // Text colors
        text: {
          primary: "#0f172a",
          secondary: "#64748b",
          tertiary: "#94a3b8",
          inverse: "#ffffff",
          muted: "#cbd5e1",
        },
        // Grayscale
        gray: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        // Semantic colors
        success: "#22c55e",
        warning: "#f59e0b",
        error: "#ef4444",
        info: "#3b82f6",
        // Tag/Badge colors
        tag: {
          blue: "#dbeafe",
          "blue-text": "#1e40af",
          green: "#dcfce7",
          "green-text": "#166534",
          purple: "#f3e8ff",
          "purple-text": "#6b21a8",
          orange: "#ffedd5",
          "orange-text": "#c2410c",
          yellow: "#fef3c7",
          "yellow-text": "#a16207",
          gray: "#f1f5f9",
          "gray-text": "#475569",
        },
        // Highlight colors for badges
        highlight: {
          fortune: "#3b82f6",
          vc: "#a855f7",
          founder: "#22c55e",
          exit: "#f97316",
          ipo: "#eab308",
          unicorn: "#8b5cf6",
          yc: "#ff6600",
          series: "#06b6d4",
        },
        // Card styles
        card: {
          bg: "#ffffff",
          border: "#e2e8f0",
          hover: "#f8fafc",
        },
      },
      // Typography
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["SF Mono", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["12px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "20px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["18px", { lineHeight: "28px" }],
        "2xl": ["20px", { lineHeight: "30px" }],
        "3xl": ["24px", { lineHeight: "32px" }],
        "4xl": ["30px", { lineHeight: "36px" }],
        "5xl": ["36px", { lineHeight: "40px" }],
      },
      // Spacing
      spacing: {
        "4.5": "18px",
        "5.5": "22px",
        "13": "52px",
        "15": "60px",
        "18": "72px",
        "22": "88px",
      },
      // Border radius
      borderRadius: {
        DEFAULT: "8px",
        none: "0",
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
        full: "9999px",
      },
      // Box shadows
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        card: "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)",
        "card-hover": "0 4px 12px rgba(0, 0, 0, 0.15)",
      },
      // Animations
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  darkMode: "class",
  plugins: [
    plugin(({ matchUtilities, theme }) => {
      const spacing = theme("spacing");

      // space-{n}  ->  gap: {n}
      matchUtilities(
        { space: (value) => ({ gap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );

      // space-x-{n}  ->  column-gap: {n}
      matchUtilities(
        { "space-x": (value) => ({ columnGap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );

      // space-y-{n}  ->  row-gap: {n}
      matchUtilities(
        { "space-y": (value) => ({ rowGap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );
    }),
  ],
};
