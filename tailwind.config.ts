import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        paper: '#FBF7EE',
        cream: '#E6DFCA',
        ink: '#2A2522',
        'ink-soft': '#5C544F',
        primary: '#8D2842',
        accent: '#C96236',
        rule: 'rgba(42, 37, 34, 0.12)',
        card: {
          blush: '#EDAFA6',
          olive: '#A28E4C',
          sky: '#9EB7C5',
          gold: '#E4A041',
          mauve: '#AB92A4',
          slate: '#7F8AAC',
          rose: '#C96236',
          burgundy: '#8D2842',
          navy: '#213C66',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        prose: '70ch',
        page: '76rem',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
