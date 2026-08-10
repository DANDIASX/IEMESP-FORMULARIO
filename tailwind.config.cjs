module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        iemesp: {
          900: '#013655', // azul-petróleo
          700: '#0f7f72', // teal/verde-sálvia (adjusted)
          cream: '#EBE9DA',
          burgundy: '#6C0F1A'
        }
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif']
      }
    },
  },
  plugins: [],
}
