// Compila TypeScript -> JavaScript com esbuild.
//
//   node scripts/build-ts.js            build unico (4 alvos)
//   node scripts/build-ts.js --watch    rebuild incremental ao salvar
//
// Alvos:
//   frontend/js/app.ts      -> frontend/dist/app.js     (bundle ESM do renderer)
//   frontend/main.ts        -> frontend/dist/main.js    (CJS do Electron)
//   frontend/preload.ts     -> frontend/dist/preload.js (CJS do Electron)
//   scripts/run-backend.ts  -> scripts/run-backend.js   (helper de dev)
//
// O type-checking (strict) e feito por `npx tsc --noOmit`/`npm run typecheck`;
// aqui vale o esbuild (rapido, sem checagem de tipos).
const esbuild = require('esbuild');

const targets = [
    {
        entryPoints: ['frontend/js/app.ts'],
        bundle: true,
        format: 'esm',
        outfile: 'frontend/dist/app.js',
        target: 'chrome128',
        logLevel: 'info',
    },
    {
        entryPoints: ['frontend/main.ts'],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        outfile: 'frontend/dist/main.js',
        external: ['electron', 'electron-store'],
        target: 'node20',
        logLevel: 'info',
    },
    {
        entryPoints: ['frontend/preload.ts'],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        outfile: 'frontend/dist/preload.js',
        external: ['electron'],
        target: 'node20',
        logLevel: 'info',
    },
    {
        entryPoints: ['scripts/run-backend.ts'],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        outfile: 'scripts/run-backend.js',
        target: 'node20',
        logLevel: 'info',
    },
];

async function main() {
    if (process.argv.includes('--watch')) {
        const contexts = await Promise.all(targets.map((t) => esbuild.context(t)));
        await Promise.all(contexts.map((c) => c.watch()));
        console.log('watch:ts ativo (esbuild, 4 alvos)');
    } else {
        await Promise.all(targets.map((t) => esbuild.build(t)));
        console.log('build:ts concluido (4 alvos)');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
