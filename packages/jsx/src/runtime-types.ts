import type { CompiledTemplate, TemplateResult } from 'lit';
import type { RefOrCallback } from 'lit/directives/ref.js';
import { type AttributePart, type BooleanAttributePart, type ChildPart, type EventPart, type PropertyPart } from 'lit';


export type Config = {
	children:  JSX.JSXElement | JSX.JSXElement[];
	ref:       RefOrCallback;
	style:     Record<string, string>;
	classList: Record<string, boolean>;
} & Record<string, any>;


export type JSXType =
| string
| typeof HTMLElement & { tagName?: string }
| ((config: Config) => JSX.JSXElement[]);


export interface LitPartConstructors {
	AttributePart: typeof AttributePart;
	PropertyPart:  typeof PropertyPart;
	BooleanPart:   typeof BooleanAttributePart;
	EventPart:     typeof EventPart;
	ChildPart:     typeof ChildPart;
}


export interface FakeTemplateStringsArray extends Array<string> { raw: readonly string[]; }


export interface FakeTemplateResult extends TemplateResult {
	strings: FakeTemplateStringsArray;
}


export interface FakeCompiledTemplate extends CompiledTemplate {
	h: FakeTemplateStringsArray;
}


export interface FakeCompiledTemplateResult {
	['_$litType$']: FakeCompiledTemplate;
	values:         unknown[];
}
