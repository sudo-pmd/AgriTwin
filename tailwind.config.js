/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#15803d',
          600: '#166534',
          700: '#14532d',
          800: '#0f3d22',
          900: '#0a2a17',
        },
        slateink: {
          800: '#0f172a',
          700: '#1e293b',
        },
        tech: '#0284c7',
        line: '#dde5ee',
      },
      fontFamily: {
        sans: ['Public Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '5px',
        xl: '6px',
        '2xl': '8px',
        '3xl': '10px',
        full: '9999px',
      },
      boxShadow: {
        card: 'none',
        lift: '0 18px 40px -24px rgba(15, 23, 42, 0.35)',
      },
      keyframes: {
        equalize: {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        equalize: 'equalize 0.9s ease-in-out infinite',
        pulseSoft: 'pulseSoft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
