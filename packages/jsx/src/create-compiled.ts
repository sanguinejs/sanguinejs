import { styleMap } from 'lit/directives/style-map.js';
import { ref as litRef } from 'lit/directives/ref.js';
import { getLitParts } from './jsx-utils.ts';
import type { Config, FakeCompiledTemplate, FakeCompiledTemplateResult, FakeTemplateStringsArray } from './runtime-types.ts';
import { classMap } from 'lit/directives/class-map.js';
import { PartType } from 'lit/directive.js';
import { eventNameCache } from './event-names.ts';


// These are cached by way of TemplateStringsArray reference, which is unique per call site.
// This reference is supplied through a build processor that adds a TTL function call to the
// JSX factory functions as the first parameter.
// This is the same caching mechanism that lit-html uses internally.
const compiledCache: WeakMap<TemplateStringsArray, FakeCompiledTemplate> = new WeakMap();
const ctor = getLitParts();


export const createCompiledTemplate = (
	cacheKey: TemplateStringsArray,
	type: string, {
		children,
		ref,
		style,
		classList,
		...props
	}: Config,
): FakeCompiledTemplateResult => {
	const values = [] as unknown[];
	const result: FakeCompiledTemplateResult = { _$litType$: compiledCache.get(cacheKey)!, values };

	// If it's been compiled before and cached.
	// Simply add the new values and return.
	if (result._$litType$) {
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

		if (children !== undefined)
			result.values.push(children);

		return result;
	}

	// This is the first time this template is being used.
	// Create a new compiled template and cache before returning it.
	const stringTemplate = '<' + type + '>' + '<!---->' + '</' + type + '>';
	const h = [ stringTemplate ] as FakeTemplateStringsArray;
	h.raw = h;

	// Freeze after adding the raw property.
	Object.freeze(h);

	result._$litType$ = { h, parts: [] };
	compiledCache.set(cacheKey, result._$litType$);

	const parts = result._$litType$.parts;

	if (ref) {
		result.values.push(litRef(ref));
		parts.push({
			type:  PartType.ELEMENT,
			index: 0,
		});
	}
	if (style) {
		result.values.push(styleMap(style));
		parts.push({
			type:    PartType.ATTRIBUTE,
			index:   0,
			name:    'style',
			strings: [ '', '' ],
			ctor:    ctor.AttributePart,
		});
	}
	if (classList) {
		result.values.push(classMap(classList));
		parts.push({
			type:    PartType.ATTRIBUTE,
			index:   0,
			name:    'class',
			strings: [ '', '' ],
			ctor:    ctor.AttributePart,
		});
	}

	// Add the parsed props
	for (const key in props) {
		if (!Object.hasOwn(props, key))
			continue;

		// We always add the value.
		result.values.push(props[key]);

		const type = typeof props[key];
		let eventName = eventNameCache.get(key);

		if (eventName) {
			// Use the cached event name.
			parts.push({
				type:    PartType.ATTRIBUTE,
				index:   0,
				name:    eventName,
				strings: [ '', '' ],
				ctor:    ctor.EventPart,
			});
		}
		else if (key.startsWith('on')) {
			// Convert JSX event names to their standard DOM counterpart.
			eventName = key.startsWith('on-')
				? key.slice(3)
				: key.slice(2).toLowerCase();

			eventNameCache.set(key, eventName);
			parts.push({
				type:    PartType.ATTRIBUTE,
				index:   0,
				name:    eventName,
				strings: [ '', '' ],
				ctor:    ctor.EventPart,
			});
		}
		else if (type === 'boolean') {
			// Use the boolean attribute syntax.
			parts.push({
				type:    PartType.ATTRIBUTE,
				index:   0,
				name:    key,
				strings: [ '', '' ],
				ctor:    ctor.BooleanPart,
			});
		}
		else if (type === 'string' || type === 'number') {
			// Set the attribute on the element for strings and numbers.
			parts.push({
				type:    PartType.ATTRIBUTE,
				index:   0,
				name:    key,
				strings: [ '', '' ],
				ctor:    ctor.AttributePart,
			});
		}
		else {
			// Forward anything that is not one of the primitives covered above.
			parts.push({
				type:    PartType.ATTRIBUTE,
				index:   0,
				name:    key,
				strings: [ '', '' ],
				ctor:    ctor.PropertyPart,
			});
		}
	}

	// Add the child part if children can exist.
	if (children !== undefined) {
		parts.push({
			type:  PartType.CHILD,
			index: 1,
		});
		result.values.push(children);
	}

	return result;
};