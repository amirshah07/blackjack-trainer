import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: { DEFAULT: '#0f5132', dark: '#0a3d26', light: '#157347' },
        chart: {
          hit: '#22a44e',
          stand: '#e8112d',
          double: '#eda32c',
          split: '#1f7ae0',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
