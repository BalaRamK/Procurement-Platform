import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        glass: {
          light: "rgba(255, 255, 255, 0.72)",
          dark: "rgba(15, 23, 42, 0.65)",
          border: "rgba(255, 255, 255, 0.18)",
          borderDark: "rgba(255, 255, 255, 0.08)",
        },
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
        "ios": "1.25rem",
        "ios-lg": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 4px 12px -2px rgb(0 0 0 / 0.06), 0 2px 6px -2px rgb(0 0 0 / 0.04)",
        glass: "0 8px 32px -4px rgb(0 0 0 / 0.08), 0 0 0 1px rgb(255 255 255 / 0.4) inset",
        "glass-lg": "0 24px 48px -12px rgb(0 0 0 / 0.12), 0 0 0 1px rgb(255 255 255 / 0.5) inset",
        "glass-soft": "0 4px 24px -4px rgb(0 0 0 / 0.06), 0 0 0 1px rgb(255 255 255 / 0.3) inset",
      },
      backdropBlur: {
        xs: "2px",
        glass: "12px",
        "glass-lg": "20px",
        "glass-xl": "24px",
      },
    },
  },
  plugins: [],
};
export default config;
