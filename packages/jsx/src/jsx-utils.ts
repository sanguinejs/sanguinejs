import { html, render } from 'lit';
import { directive, Directive, PartType, type PartInfo } from 'lit/directive.js';
import type { LitPartConstructors } from './runtime-types.js';


type IfEquals<X, Y, A = X> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? A : never;

type WritableKeys<T> = {
	[P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P>
}[keyof T];

type TrimReadonly<T> = Pick<T, WritableKeys<T>>;

type ExcludeHTML<T extends HTMLElement> = TrimReadonly<Omit<T, keyof HTMLElement | 'constructor'>>;


export type JSXProps<T extends HTMLElement> = Partial<ExcludeHTML<T>>
	& JSX.HTMLAttributes<T>
	& Record<never, never>;


export const toJSX = <T extends { new(...args: any): any; tagName: string }>(
	element: T,
): (props: JSXProps<InstanceType<T>>) => string => {
	if (!customElements.get(element.tagName))
		customElements.define(element.tagName, element);

	return element.tagName as any;
};


export const __ttl: (strings: TemplateStringsArray) => TemplateStringsArray = s => s;


export const getLitParts: () => LitPartConstructors = (() => {
	let hasRun = false;

	const constructors = {
		AttributePart: undefined,
		PropertyPart:  undefined,
		BooleanPart:   undefined,
		EventPart:     undefined,
		ChildPart:     undefined,
	} satisfies Record<keyof LitPartConstructors, undefined> as
		any as LitPartConstructors;

	const partCtorGrabber: any = directive(class PartCtorGrabber extends Directive {

		constructor(part: PartInfo) {
			super(part);

			if (part.type === PartType.ATTRIBUTE)
				constructors.AttributePart = part.constructor as any;
			else if (part.type === PartType.PROPERTY)
				constructors.PropertyPart = part.constructor as any;
			else if (part.type === PartType.BOOLEAN_ATTRIBUTE)
				constructors.BooleanPart = part.constructor as any;
			else if (part.type === PartType.EVENT)
				constructors.EventPart = part.constructor as any;
			else if (part.type === PartType.CHILD)
				constructors.ChildPart = part.constructor as any;
		}

		public override render(): void {}

	});

	return () => {
		if (!hasRun) {
			const g = partCtorGrabber;
			hasRun = !!render(
				html`<div prop=${ g() } .prop=${ g() } ?prop=${ g() } @prop=${ g() }>${ g() }</div>`,
				document.createElement('div'),
			);
		}

		return constructors;
	};
})();
