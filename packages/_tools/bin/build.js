import Bun from 'bun';
import fs from 'node:fs/promises';
export const build = async (pkgDir) => {
    pkgDir = pkgDir.replaceAll('\\', '/');
    const pkgJson = await fs.readFile(pkgDir + '/package.json', 'utf8');
    const parsedPkg = JSON.parse(pkgJson);
    const packageName = parsedPkg.name;
    const pattern = new Bun.Glob(pkgDir + '/src/**/*.ts');
    const files = [...pattern.scanSync()];
    console.info(packageName + ': Cleaning previous build...');
    await fs.rm(pkgDir + '/dist', { recursive: true, force: true });
    console.info(packageName + ': Building...');
    await Bun.build({
        entrypoints: files,
        splitting: false,
        sourcemap: 'none',
        packages: 'external',
        external: ['*'],
        minify: {
            syntax: true,
            identifiers: true,
            whitespace: false,
        },
        outdir: pkgDir + '/dist',
    });
    console.info(packageName + ': Done');
};
