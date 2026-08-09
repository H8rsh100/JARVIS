/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#05080f",
        mist: "#8fa3b8",
        copper: "#c47a3a",
        signal: "#3dd6c6",
        "signal-bright": "#7ef0e4",
        panel: "#0a101c",
      },
      fontFamily: {
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
