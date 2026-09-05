import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    borderRadius: {
      none: '0px',
      DEFAULT: '0px',
      sm: '0px',
      md: '0px',
      lg: '0px',
      xl: '0px',
      '2xl': '0px',
      '3xl': '0px',
      full: '9999px',
    },
    extend: {
      colors: {
        background: '#f5f1e8',
        surface: '#f5f1e8',
        'surface-elevated': '#fffcf5',
        'surface-dim': '#eae5da',
        'border-subtle': '#d8d3c6',
        'border-strong': '#b8b4a5',
        'text-primary': '#252e29',
        'text-secondary': '#505950',
        'text-tertiary': '#697166',
        accent: '#ad422e',
        'accent-muted': '#efd6c9',
        'accent-foreground': '#fffcf5',
        success: '#2e7d32',
        warning: '#e65100',
        error: '#ba1a1a',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-body)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
