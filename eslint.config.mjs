// Configuração ESLint (flat config) para o renderer do CREMEPE Office.
// Escopo: frontend/js (ES modules, browser). main.js/preload.js/logger.js
// são CommonJS do processo main do Electron e ficam de fora.
import js from '@eslint/js';

export default [
    {
        // Arquivos do renderer
        files: ['frontend/js/**/*.js'],
        ignores: ['frontend/js/main.js', 'frontend/js/preload.js', 'frontend/js/logger.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Browser
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                prompt: 'readonly',
                event: 'readonly',
                localStorage: 'readonly',
                FileReader: 'readonly',
                Event: 'readonly',
                Blob: 'readonly',
                URL: 'readonly',
                FormData: 'readonly',
                AbortController: 'readonly',
                structuredClone: 'readonly',
                MutationObserver: 'readonly',
                requestAnimationFrame: 'readonly',
                // Electron (exposto pelo preload via contextBridge)
                electronAPI: 'readonly',
                // CDNs
                pdfjsLib: 'readonly',
                bootstrap: 'readonly',
            },
        },
        plugins: {
            // regras recomendadas do ESLint via flat config
        },
        rules: {
            ...js.configs.recommended.rules,
            // O código legado tem variações aceitáveis — regras relaxadas
            'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-undef': 'error',
            'no-redeclare': 'error',
            'no-fallthrough': 'error',
            'no-constant-condition': 'warn',
            // Estilo deixamos de fora (sem prettier neste item)
            'no-unused-expressions': 'warn',
        },
    },
    {
        // Processo main do Electron (CommonJS) — fica de fora do lint neste item
        files: ['frontend/main.js', 'frontend/preload.js', 'frontend/logger.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                fetch: 'readonly',
                Buffer: 'readonly',
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': ['warn', { args: 'none' }],
        },
    },
];
