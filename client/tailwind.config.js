/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0e7ff',
          100: '#d4bbff',
          200: '#b78eff',
          300: '#9a61ff',
          400: '#7d34ff',
          500: '#6d28d9',
          600: '#5b21b6',
          700: '#4c1d95',
          800: '#3b0f7a',
          900: '#2e0a61',
        },
        dark: {
          50: '#1a1a2e',
          100: '#16162a',
          200: '#121226',
          300: '#0f0f23',
          400: '#0a0a1a',
          500: '#060612',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
