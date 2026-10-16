/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff1f5',
          100: '#ffe0e9',
          200: '#ffb3c8',
          300: '#ff8faa',
          400: '#f46b91',
          500: '#d51a50',
          600: '#b30f3c',
          700: '#920c31',
          800: '#700a26',
          900: '#490619',
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
