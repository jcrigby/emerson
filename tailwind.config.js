/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          50: "#fdfbf7",
          100: "#f9f5ed",
          200: "#f3ebdb",
          300: "#e8dcc4",
          400: "#d4c4a1",
          500: "#bda67e",
        },
        ink: {
          50: "#f6f5f4",
          100: "#e7e4e1",
          200: "#d1cbc4",
          300: "#b5aa9d",
          400: "#9a8b7a",
          500: "#7f7060",
          600: "#685b4e",
          700: "#554a41",
          800: "#473f38",
          900: "#3d3632",
          950: "#211d1a",
        },
        accent: {
          DEFAULT: "#2d4a3e",
          light: "#3d6352",
          dark: "#1e332b",
        },
        highlight: {
          DEFAULT: "#d4a853",
          light: "#e4c078",
          dark: "#b8923f",
        },
      },
      fontFamily: {
        serif: ["Lora", "Georgia", "serif"],
        sans: ["Source Sans 3", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
}
