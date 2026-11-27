/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class', not the default 'media' (0.6.2): on the web dev server NativeWind sets the colour scheme once its CSS
  // arrives, and 'media' makes that throw ("Cannot manually set color scheme"). TangTu has no `dark:` classes: the
  // themes come from ThemeProvider, so nothing else changes.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        danger: { DEFAULT: '#E5606F', soft: '#FDE8EA' },
      },
      // Android ignores fontWeight for custom fonts, so each Nunito weight is its own family.
      fontFamily: {
        nunito: ['Nunito_400Regular'],
        'nunito-semibold': ['Nunito_600SemiBold'],
        'nunito-bold': ['Nunito_700Bold'],
        'nunito-extrabold': ['Nunito_800ExtraBold'],
      },
    },
  },
  plugins: [],
};
