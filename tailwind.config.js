/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Vazirmatn"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
      },
      colors: {
        // Brand
        primary: "rgb(var(--color-primary) / <alpha-value>)", // Original dark brand
        primaryDark: "rgb(var(--color-primary-dark) / <alpha-value>)", // Original dark brand surface
        accent: "rgb(var(--color-accent) / <alpha-value>)", // Original green accent

        // Base Backgrounds (Neutral/Gray)
        bgApp: "rgb(var(--color-bg-app) / <alpha-value>)", // App base
        bgSurface: "rgb(var(--color-bg-surface) / <alpha-value>)", // Elevated surface
        borderSubtle: "rgb(var(--color-border-subtle) / <alpha-value>)", // Soft border

        // Text
        textPrimary: "rgb(var(--color-text-primary) / <alpha-value>)", // Primary text
        textMuted: "rgb(var(--color-text-muted) / <alpha-value>)", // Muted text

        // Status
        danger: "#DC2626",
        warning: "#D97706",
        success: "#22C55E",

        // Duplicate keys (Strictly preserving your structure)
        bgSidebar: "rgb(var(--color-bg-app) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--color-bg-surface) / <alpha-value>)",
          muted: "rgb(var(--color-surface-muted) / <alpha-value>)",
          strong: "rgb(var(--color-surface-strong) / <alpha-value>)",
        },
        border: "rgb(var(--color-border-subtle) / <alpha-value>)",
        text: {
          primary: "rgb(var(--color-text-primary) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
