/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        velora: {
          ivory: {
            DEFAULT: '#FAF8F5',
            50: '#FFFFFF',
            100: '#FAF8F5',
            200: '#F2EDE4',
            300: '#E7DFD0',
          },
          green: {
            DEFAULT: '#153020',
            dark: '#0E2116',
            light: '#1F4730',
          },
          sage: {
            DEFAULT: '#628B72',
            light: '#EBF2EE',
            dark: '#4A6B56',
          },
          copper: {
            DEFAULT: '#B86B35',
            light: '#FAF1EB',
            dark: '#935124',
          },
          amber: {
            DEFAULT: '#D97706',
            light: '#FEF3C7',
          },
          red: {
            DEFAULT: '#DC2626',
            light: '#FEE2E2',
          },
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
