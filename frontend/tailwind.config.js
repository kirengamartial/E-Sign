/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bankid: {
          50:  '#EEF3FB',
          100: '#D5E3F5',
          500: '#235EA6',
          700: '#193B6E',
          900: '#0D1F3C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
