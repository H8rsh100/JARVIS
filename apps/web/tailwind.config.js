/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070b12",
        mist: "#9fb0c3",
        copper: "#c47a3a",
        signal: "#3dd6c6",
        panel: "#0e1522",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(61, 214, 198, 0.25)",
      },
    },
  },
  plugins: [],
};
