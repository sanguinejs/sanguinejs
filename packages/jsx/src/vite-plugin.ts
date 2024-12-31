import type { Plugin } from 'vite';


export const sanguineJsx = (): Plugin => {
	return {
		name:    'sanguine-jsx',
		enforce: 'post',
		transform(code, id) {
			if (!id.endsWith('.tsx'))
				return;

			code = 'import { __ttl } from "@roenlie/sanguine-jsx";\n' + code;
			code = code.replaceAll('jsxDEV(', () => 'jsxDEV(' + '__ttl``,');
			code = code.replaceAll('jsxs(', () => 'jsxs(' + '__ttl``,');
			code = code.replaceAll('jsx(', () => 'jsx(' + '__ttl``,');

			return code;
		},
	};
};
