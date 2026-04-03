/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        mono: ['Azeret Mono', 'monospace'],
      },
      colors: {
        surface: {
          0: '#0c0c0e',
          1: '#141416',
          2: '#1c1c20',
          3: '#252529',
          4: '#2e2e33',
        },
        edge: {
          DEFAULT: '#363640',
          strong: '#4a4a56',
          subtle: '#222228',
          muted: '#2e2e33',
        },
        accent: {
          DEFAULT: '#22d3ee',
          cyan: '#22d3ee',
          blue: '#60a5fa',
          green: '#4ade80',
          amber: '#fbbf24',
          red: '#f87171',
          purple: '#c4b5fd',
          orange: '#fb923c',
        },
        text: {
          primary: '#f4f4f5',
          secondary: '#d4d4d8',
          tertiary: '#a1a1aa',
          muted: '#71717a',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        glow: {
          from: { boxShadow: '0 0 4px rgba(34,211,238,0.1)' },
          to: { boxShadow: '0 0 16px rgba(34,211,238,0.2)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
