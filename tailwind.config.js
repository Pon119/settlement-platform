/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'warm-dark': '#2d1b1b',
        'warm-gray': '#5d4e4e', 
        'soft-brown': '#8b6f6f',
        'contrast': '#1a1a1a',
        pink: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#fecfef',
          400: '#ff9a9e',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
        peach: {
          50: '#fefbf7',
          100: '#fef3e2',
          200: '#fecfef',
          300: '#fcb69f',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        }
      },
      backgroundImage: {
        'pink-gradient': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      }
    },
  },
  plugins: [],
}