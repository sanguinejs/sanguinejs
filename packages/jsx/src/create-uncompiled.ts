import type { TemplateResult } from 'lit';
import { ref as litRef } from 'lit/directives/ref.js';
import { eventNameCache } from './event-names.ts';
import type { Config, FakeTemplateResult, FakeTemplateStringsArray } from './runtime-types.ts';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit/directives/class-map.js';


// Lit wants to receive the same template strings array for the same template.
// We cache these to avoid creating new arrays for every render.
// These are cached by way of TemplateStringsArray reference, which is unique per  call site.
// These are supplied through a build processor that adds a TTL function call to the
// JSX factory functions as the first parameter.
// This is the same caching mechanism that lit-html uses internally.
const templateCache: WeakMap<TemplateStringsArray, FakeTemplateStringsArray> = new WeakMap();


export const createTemplateResult = (
	cacheKey: TemplateStringsArray,
	type: string, {
		children,
		ref,
		style,
		classList,
		...props
	}: Config,
): TemplateResult => {
	const result = {
		_$litType$: 1,
		strings:    templateCache.get(cacheKey),
		values:     [ '' ],
	} as FakeTemplateResult;

	if (result.strings) {
		if (ref)
			result.values.push(litRef(ref));
		if (style)
			result.values.push(styleMap(style));
		if (classList)
			result.values.push(classMap(classList));

		for (const propName in props) {
			if (Object.hasOwn(props, propName))
				result.values.push(props[propName]);
		}

		result.values.push(children);

		return result;
	}

	result.strings = [ '<' + type + ' ' ] as FakeTemplateStringsArray;
	templateCache.set(cacheKey, result.strings);

	if (ref) {
		result.strings.push(' ');
		result.values.push(litRef(ref));
	}
	if (style) {
		result.strings.push(' style=');
		result.values.push(styleMap(style));
	}
	if (classList) {
		result.strings.push(' class=');
		result.values.push(classMap(classList));
	}

	for (const propName in props) {
		if (!Object.hasOwn(props, propName))
			continue;

		let key = '';

		const cachedEventName = eventNameCache.get(propName);
		if (cachedEventName) {
			// Use the cached event name.
			key = cachedEventName;
		}
		else if (propName.startsWith('on')) {
			// Convert JSX event names to their standard DOM counterpart.
			const eventName = propName.startsWith('on-')
				? '@' + propName.slice(3)
				: '@' + propName.slice(2).toLowerCase();

			eventNameCache.set(propName, eventName);
			key = eventName;
		}
		else if (typeof props[propName] === 'boolean') {
			// Use the boolean attribute syntax.
			key = '?' + propName;
		}
		else if (typeof props[propName] === 'object') {
			// Forward anything that is an object.
			key = '.' + propName;
		}
		else if (typeof props[propName] === 'function') {
			// Forward anything that is a function.
			key = '.' + propName;
		}
		else {
			// Set the attribute on the element.
			key = propName;
		}

		result.strings.push(' ' + key + '=');
		result.values.push(props[propName]);
	};

	result.strings.push('>');
	result.strings.push('</' + type + '>');

	result.strings.raw = Object.freeze([ ...result.strings ]);
	result.strings = Object.freeze(result.strings);

	result.values.push(children);

	return result;
};