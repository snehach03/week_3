/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFCF7',
          100: '#FAF6ED',
          200: '#F2ECE0',
          300: '#E5DBC7',
        },
        espresso: {
          950: '#1D120C',
          900: '#2D1C15',
          800: '#3F2920',
          700: '#5C4033',
          600: '#755444',
          500: '#8E7060',
          200: '#D9C8BE',
          100: '#ECE3DD',
        },
        terracotta: {
          50: '#FDF5F2',
          100: '#F9E7E2',
          500: '#C86D51',
          600: '#B85D43',
          700: '#974730',
        },
        sage: {
          50: '#F4F7F4',
          100: '#E6ECE6',
          500: '#5C7A63',
          600: '#4C6752',
          700: '#394F3E',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'warm-sm': '0 1px 3px rgba(45, 28, 21, 0.04), 0 1px 2px rgba(45, 28, 21, 0.02)',
        'warm-md': '0 4px 6px -1px rgba(45, 28, 21, 0.05), 0 2px 4px -1px rgba(45, 28, 21, 0.03)',
        'warm-lg': '0 10px 15px -3px rgba(45, 28, 21, 0.06), 0 4px 6px -2px rgba(45, 28, 21, 0.03)',
      }
    },
  },
  plugins: [],
}
