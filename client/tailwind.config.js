/** @type {import('tailwindcss').Config} */
// Design tokens for the whole app. Pages use `brand-*` (deep ink blue), `canvas` (page background)
// and the neutral `slate` scale; semantic colours (emerald / amber / red) are used only for status.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        serif: ["Source Serif 4", "Georgia", "Cambria", "Times New Roman", "serif"],
      },
      colors: {
        canvas: "#F7F6F3",
        brand: {
          50: "#F4F7FB", 100: "#E4EBF4", 200: "#C9D6E8", 300: "#9DB3D0", 400: "#6B8AB3",
          500: "#355B8C", 600: "#1F3A5F", 700: "#172D4A", 800: "#112238", 900: "#0B1627",
        },
        gold: { 400: "#C2A15B", 500: "#A8843F" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04)",
        pop: "0 12px 32px -8px rgba(15, 23, 42, 0.25)",
      },
      borderRadius: { xl: "0.75rem" },
    },
  },
  plugins: [],
};
