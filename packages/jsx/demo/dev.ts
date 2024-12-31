import { build, Glob } from 'bun';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { statSync, watch } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { log } from 'node:console';


declare global {
	// eslint-disable-next-line no-var
	var bunWatcher: ReturnType<typeof watch> | undefined;
}

const hmrModule =  `
const url = 'ws://' + location.host + '/hmr';
let socket = undefined;
const setupConnection = () => {
	socket = new WebSocket(url);
	socket.addEventListener('message', reload);
	socket.addEventListener('close', reconnect);
	socket.addEventListener('error', reconnect);
};
const reload = () => location.reload();
const reconnect = () => setTimeout(() => {
	if (socket) {
		socket.removeEventListener('message', reload);
		socket.removeEventListener('close', reconnect);
		socket.removeEventListener('error', reconnect);
	}
	socket = new WebSocket(url);
	socket.addEventListener('open', reload);
	socket.addEventListener('error', reconnect);
}, 2000);
setupConnection();
`;


const BASE_PATH = './.out-dev/';

const hmrBuild = async () => {
	await rm('.out-dev', { recursive: true, force: true });
	await build({
		entrypoints: [ 'src/index.ts' ],
		splitting:   true,
		minify:      false,
		sourcemap:   'linked',
		outdir:      BASE_PATH,
		//html:            true,
		//experimentalCss: true,
	});

	{  // This will hopefully be removed when bun is at version 1.1.43>=
		let indexContent = await readFile(join('src', 'index.html'), 'utf-8');
		indexContent = indexContent.replaceAll('.ts', '.js');
		indexContent = indexContent.replaceAll(
			'<head>', '<head>\n'
			+ '<script type="module">'
			+ hmrModule
			+ '</script>\n',
		);

		await writeFile(join(BASE_PATH, 'index.html'), indexContent);

		// We don't want to do this on every build.
		// But I don't have a good way to do it yet.
		const publicPattern = new Glob('public/**/*');
		for await (const file of publicPattern.scan({ absolute: true })) {
			const dest = file.replace('public', '.out-dev');
			const dir = dest.split(sep).slice(0, -1).join(sep);

			await mkdir(dir, { recursive: true });
			await copyFile(file, dest);
		}
	}
};

await hmrBuild();

const fileUpdateMap: Map<string, { ctime: number; path: string; }> = new Map();

// We only want to set up the watcher once.
globalThis.bunWatcher?.close();
globalThis.bunWatcher = watch(
	import.meta.dir + '/src',
	{ recursive: true },
	(_event, filename) => {
		if (!filename)
			return;

		const previous = fileUpdateMap.get(filename) ?? fileUpdateMap
			.set(filename, { ctime: 0, path: join(resolve(), 'src', filename) })
			.get(filename)!;

		const stat = statSync(previous.path, { throwIfNoEntry: false });
		if (previous.ctime === stat?.ctimeMs)
			return;

		if (!stat) {
			fileUpdateMap.delete(filename);
			filesChanged('rename', filename);
		}
		else {
			previous.ctime = stat.ctimeMs;
			filesChanged('update', filename);
		}
	},
);

// This is needed to stop the watcher when the process is killed.
process.on('SIGINT', () => {
	globalThis.bunWatcher?.close();
	process.exit(0);
});


const filesChanged = async (event: 'rename' | 'update', path: string) => {
	await hmrBuild();
	server.publish('hmr', event + ':' + path);
};


const server = Bun.serve({
	port: 3001,
	fetch(req): any {
		const path = new URL(req.url).pathname;

		if (path === '/hmr') {
			const success = server.upgrade(req);
			if (success)
				return; // Bun automatically returns a 101 Switching Protocols.
		}

		let filePath = path;
		if (filePath === '/')
			filePath = '/index.html';

		filePath = BASE_PATH + filePath;
		filePath = filePath.replaceAll(/\.ts/g, '.js');
		//console.log('filePath', filePath);

		return new Response(Bun.file(filePath));
	},
	error(error) {
		console.error(error);

		return new Response(null, { status: 404 });
	},
	websocket: {
		open(ws) {
			ws.subscribe('hmr');
		},
		// this is called when a message is received
		async message(_ws, _message) {},
		close(ws, _code, _reason) {
			ws.unsubscribe('hmr');
		},
	},
});


log('Server running at', `\x1b[33m${ server.url.toString() }  \x1b[0m`);
