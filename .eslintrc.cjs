/**
 * ESLint Configuration for Ludora Backend API
 * Enforces data-driven caching patterns and code quality
 */

module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  plugins: [
    'ludora' // Our custom plugin
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Ludora Custom Rules - Architecture Enforcement
    'ludora/no-time-based-caching': 'error', // BLOCKS PR APPROVAL
    'ludora/require-data-driven-cache': 'warn',
    'ludora/no-unused-cache-keys': 'warn',
    'ludora/no-console-log': ['error', {
      allowInTests: true,
      allowInMigrations: true
    }],

    // Standard ESLint Rules - Code Quality
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-duplicate-imports': 'error',
    'no-constant-condition': 'error',
    'no-debugger': 'error',

    // Best Practices
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-return-await': 'error',
    'no-throw-literal': 'error',
    'no-unused-expressions': ['error', {
      allowShortCircuit: true,
      allowTernary: true
    }],
    'prefer-const': 'error',
    'prefer-destructuring': ['warn', {
      array: false,
      object: true
    }],

    // Async/Await Best Practices
    'no-async-promise-executor': 'error',
    'no-await-in-loop': 'warn',
    'prefer-promise-reject-errors': 'error',
    'require-atomic-updates': 'error',

    // Node.js Specific
    'handle-callback-err': 'error',
    'no-buffer-constructor': 'error',
    'no-new-require': 'error',
    'no-path-concat': 'error',

    // Code Style (minimal, since we're not using Prettier)
    'array-bracket-spacing': ['error', 'never'],
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'comma-spacing': ['error', { before: false, after: true }],
    'comma-style': ['error', 'last'],
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],
    'keyword-spacing': ['error', { before: true, after: true }],
    'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 0 }],
    'no-trailing-spaces': 'error',
    'object-curly-spacing': ['error', 'always'],
    'semi': ['error', 'always'],
    'space-before-blocks': 'error',
    'space-infix-ops': 'error',
    'space-unary-ops': ['error', {
      words: true,
      nonwords: false
    }]
  },
  overrides: [
    {
      // Special rules for migration files
      files: ['migrations/**/*.js'],
      rules: {
        'ludora/no-console-log': 'off', // Migrations can use console.log
        'no-unused-vars': 'off' // queryInterface might appear unused
      }
    },
    {
      // Special rules for test files
      files: ['**/*.test.js', '**/*.spec.js', 'tests/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'ludora/no-console-log': 'off', // Tests can use console.log
        'no-unused-expressions': 'off' // Chai assertions
      }
    },
    {
      // Special rules for configuration files
      files: ['*.config.js', 'config/**/*.js'],
      rules: {
        'no-process-env': 'off' // Config files access process.env
      }
    }
  ],
  globals: {
    // Ludora-specific globals
    clog: 'readonly',
    cerror: 'readonly'
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '*.min.js',
    'coverage/',
    '.git/',
    'logs/',
    'uploads/',
    'public/'
  ]
};