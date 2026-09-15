export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Marca — vermelho-açougue dessaturado, sóbrio, tema temático sem cansar
        brand: {
          50:  '#FFF1EC',
          100: '#FEDDD0',
          200: '#FCB89D',
          300: '#F6916B',
          400: '#E97540',
          500: '#C2410C',
          600: '#9A3412',
          700: '#7C2D12',
          800: '#5C2410',
          900: '#3D1A0B',
        },
        // Página: off-white quente, fácil pra vista em jornada longa
        page: '#FAF7F2',
        // Tinta: cinza-quente em vez de cinza-azulado frio
        ink: {
          DEFAULT: '#1F1B16',
          muted:   '#6B6055',
          faded:   '#9C9088',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      boxShadow: {
        'soft':  '0 1px 2px rgba(31,27,22,0.04), 0 1px 3px rgba(31,27,22,0.03)',
        'lift':  '0 4px 12px rgba(31,27,22,0.08), 0 2px 4px rgba(31,27,22,0.04)',
        'modal': '0 20px 40px rgba(31,27,22,0.12), 0 8px 16px rgba(31,27,22,0.08)',
      },
    },
  },
  safelist: [
    'bg-emerald-50','bg-emerald-100','bg-emerald-600','bg-emerald-700',
    'text-emerald-600','text-emerald-700','text-emerald-800',
    'border-emerald-200','border-emerald-600',
    'bg-red-50','bg-red-100','bg-red-600','bg-red-700',
    'text-red-600','text-red-700','text-red-800',
    'border-red-200','border-red-600',
    'bg-amber-50','bg-amber-100','bg-amber-600','bg-amber-700',
    'text-amber-600','text-amber-700','text-amber-800',
    'border-amber-200','border-amber-600',
    'bg-blue-50','bg-blue-100','bg-blue-600','bg-blue-700',
    'text-blue-600','text-blue-700','text-blue-800',
    'border-blue-200','border-blue-600',
    'bg-purple-50','text-purple-700','border-purple-600',
    'bg-orange-50','text-orange-700','border-orange-600',
    'bg-brand-50','bg-brand-500','bg-brand-600','bg-brand-700',
    'text-brand-600','text-brand-700','text-brand-800',
    'border-brand-200','border-brand-500','border-brand-600',
    'hover:bg-brand-700','hover:bg-brand-600',
  ],
  plugins: [],
};
