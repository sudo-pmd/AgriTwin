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
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        lift: '0 10px 30px -12px rgba(15, 23, 42, 0.28)',
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
