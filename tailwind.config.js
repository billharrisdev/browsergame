/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bass: '#ff3333',
        mid: '#33ff33', 
        high: '#3333ff',
        neon: {
          cyan: '#00ffff',
          pink: '#ff00ff',
          blue: '#0080ff',
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
        'frequency-wave': 'frequency-wave 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 255, 255, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 255, 255, 0.8)' },
        },
        'frequency-wave': {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(1.5)' },
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
