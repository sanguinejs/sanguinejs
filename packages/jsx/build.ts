import Bun from 'bun';
import fs from 'node:fs/promises';


const pattern = new Bun.Glob('src/**/*.ts');
const files = [ ...pattern.scanSync() ];

// Remove previous build
await fs.rm('dist', { recursive: true, force: true });
// Build
await Bun.build({
	entrypoints: files,
	splitting:   false,
	sourcemap:   'none',
	packages:    'external',
	external:    [ '*' ],
	minify:      {
		syntax:      true,
		identifiers: true,
		whitespace:  false,
	},
	outdir: 'dist',
});
