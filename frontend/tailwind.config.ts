import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // All values driven by CSS custom properties — see src/styles/themes.css
        // :root = admin (light), html.dark = employee portal
        'primary':                   'var(--tw-primary)',
        'on-primary':                'var(--tw-on-primary)',
        'primary-container':         'var(--tw-primary-container)',
        'on-primary-container':      'var(--tw-on-primary-container)',
        'primary-fixed':             'var(--tw-primary-fixed)',
        'primary-fixed-dim':         'var(--tw-primary-fixed-dim)',
        'on-primary-fixed':          'var(--tw-on-primary-fixed)',
        'on-primary-fixed-variant':  'var(--tw-on-primary-fixed-variant)',
        'secondary':                 'var(--tw-secondary)',
        'on-secondary':              'var(--tw-on-secondary)',
        'secondary-container':       'var(--tw-secondary-container)',
        'on-secondary-container':    'var(--tw-on-secondary-container)',
        'tertiary':                  'var(--tw-tertiary)',
        'on-tertiary':               'var(--tw-on-tertiary)',
        'tertiary-container':        'var(--tw-tertiary-container)',
        'on-tertiary-container':     'var(--tw-on-tertiary-container)',
        'surface':                   'var(--tw-surface)',
        'on-surface':                'var(--tw-on-surface)',
        'on-surface-variant':        'var(--tw-on-surface-variant)',
        'surface-dim':               'var(--tw-surface-dim)',
        'surface-bright':            'var(--tw-surface-bright)',
        'surface-container-lowest':  'var(--tw-surface-container-lowest)',
        'surface-container-low':     'var(--tw-surface-container-low)',
        'surface-container':         'var(--tw-surface-container)',
        'surface-container-high':    'var(--tw-surface-container-high)',
        'surface-container-highest': 'var(--tw-surface-container-highest)',
        'surface-variant':           'var(--tw-surface-variant)',
        'background':                'var(--tw-background)',
        'on-background':             'var(--tw-on-background)',
        'error':                     'var(--tw-error)',
        'on-error':                  'var(--tw-on-error)',
        'error-container':           'var(--tw-error-container)',
        'on-error-container':        'var(--tw-on-error-container)',
        'outline':                   'var(--tw-outline)',
        'outline-variant':           'var(--tw-outline-variant)',
        'inverse-surface':           'var(--tw-inverse-surface)',
        'inverse-on-surface':        'var(--tw-inverse-on-surface)',
        'inverse-primary':           'var(--tw-inverse-primary)',
        'surface-tint':              'var(--tw-surface-tint)',
      },
      fontFamily: {
        headline: ['"Space Grotesk"', 'sans-serif'],
        body:     ['"Manrope"', 'sans-serif'],
        label:    ['"Manrope"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg:      '0.5rem',
        xl:      '0.75rem',
        '2xl':   '1.25rem',
        '3xl':   '1.5rem',
        full:    '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
