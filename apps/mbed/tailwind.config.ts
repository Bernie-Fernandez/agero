import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        linen: "#F5F3EF",
        charcoal: "#1A1714",
        stone: "#9A8670",
        dusk: "#7D7168",
        cream: "#FDFCFA",
      },
      fontFamily: {
        cormorant: ["var(--font-cormorant)", "serif"],
        dm: ["var(--font-dm-sans)", "sans-serif"],
      },
      keyframes: {
        heroZoom: {
          "0%": { transform: "scale(1.04)" },
          "100%": { transform: "scale(1.0)" },
        },
      },
      animation: {
        "hero-zoom": "heroZoom 14s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
