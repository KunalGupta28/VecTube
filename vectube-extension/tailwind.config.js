import daisyui from 'daisyui';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{vue,js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      height: {
        108: '27rem',
      },
    },
  },
  plugins: [daisyui, typography],
  daisyui: {
    themes: ['light', 'dark', 'lofi'],
    darkTheme: 'lofi',
  },
};
