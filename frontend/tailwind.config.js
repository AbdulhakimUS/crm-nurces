/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#e6f1fb',
          100: '#b5d4f4',
          500: '#1a6fb5',
          600: '#155d9a',
          700: '#0f4a7f',
        },
        medical: {
          50:  '#f0f9f6',
          100: '#d0ede6',
          500: '#0d7a5f',
          600: '#0a6550',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace']
      }
    }
  },
  plugins: []
}