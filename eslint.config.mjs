// Configuração ESLint (flat config) para o TypeScript do CREMEPE Office.
// Escopo: frontend/**/*.ts (renderer em ES modules + processo main/preload
// do Electron). O bundle gerado (frontend/dist) e o vendor ficam de fora.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'frontend/dist/**',
            'frontend/vendor/**',
            'frontend/css/**',
            'node_modules/**',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['frontend/**/*.ts'],
        rules: {
            // Código migrado de JS: variações aceitáveis — regras relaxadas
            '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
            // Fronteiras vendorizadas (pdf.js/Lucide minificados sem tipos)
            '@typescript-eslint/no-explicit-any': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-fallthrough': 'error',
            'no-constant-condition': 'warn',
            // Estilo deixamos de fora (sem prettier neste item)
            'no-unused-expressions': 'warn',
        },
    },
);
