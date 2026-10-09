/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        violet: '#6C5CE7',
        'violet-soft': '#EEECFB',
        ink: '#1A1A2E',
        muted: '#8A8FA3',
        line: '#E8E9F0',
        canvas: '#FAFAFE',
        ok: '#2BB673',
        warn: '#E8A93C',
        bad: '#E05A52',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,20,40,0.04), 0 4px 12px rgba(20,20,40,0.04)',
      },
      keyframes: {
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'dot-spin': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'cursor-blink': 'cursor-blink 1s steps(1) infinite',
        'dot-spin': 'dot-spin 0.9s linear infinite',
      },
    },
  },
  plugins: [],
}
