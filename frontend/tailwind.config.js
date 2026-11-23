/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        velora: {
          burgundy: {
            DEFAULT: 'rgb(var(--velora-burgundy) / <alpha-value>)',
            dark: 'rgb(var(--velora-burgundy-dark) / <alpha-value>)',
            light: 'rgb(var(--velora-burgundy-light) / <alpha-value>)',
          },
          rose: {
            DEFAULT: 'rgb(var(--velora-rose) / <alpha-value>)',
            dark: 'rgb(var(--velora-rose-dark) / <alpha-value>)',
            light: 'rgb(var(--velora-rose-light) / <alpha-value>)',
          },
          gold: {
            DEFAULT: 'rgb(var(--velora-gold) / <alpha-value>)',
            dark: 'rgb(var(--velora-gold-dark) / <alpha-value>)',
            light: 'rgb(var(--velora-gold-light) / <alpha-value>)',
          },
          charcoal: {
            DEFAULT: 'rgb(var(--velora-charcoal) / <alpha-value>)',
            dark: 'rgb(var(--velora-charcoal-dark) / <alpha-value>)',
            light: 'rgb(var(--velora-charcoal-light) / <alpha-value>)',
          },
          ivory: {
            DEFAULT: 'rgb(var(--velora-ivory) / <alpha-value>)',
            50: 'rgb(var(--velora-white) / <alpha-value>)',
            100: 'rgb(var(--velora-ivory) / <alpha-value>)',
            200: 'rgb(var(--velora-ivory-200) / <alpha-value>)',
            300: 'rgb(var(--velora-ivory-300) / <alpha-value>)',
          },
          sage: {
            DEFAULT: 'rgb(var(--velora-sage) / <alpha-value>)',
            light: 'rgb(var(--velora-sage-light) / <alpha-value>)',
            dark: 'rgb(var(--velora-sage-dark) / <alpha-value>)',
          },
          amber: {
            DEFAULT: 'rgb(var(--velora-amber) / <alpha-value>)',
            light: 'rgb(var(--velora-amber-light) / <alpha-value>)',
          },
          red: {
            DEFAULT: 'rgb(var(--velora-red) / <alpha-value>)',
            light: 'rgb(var(--velora-red-light) / <alpha-value>)',
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
