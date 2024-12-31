import { nanoid } from 'nanoid';


export type stringliteral = string & Record<never, never>;
export type Identifier = string | symbol;
export type Lifetimes = 'singleton' | 'transient';

export interface BaseBinding {
	type:        stringliteral;
	initializer: any;
	cache:       any;
	method:      Lifetimes;
	named?:      Identifier;
	tagged?:     Identifier;
	moduleId?:   Identifier;
}
export interface ClassBinding extends BaseBinding {
	type:        'class';
	initializer: new (...args: any[]) => any;
}
export interface FactoryBinding extends BaseBinding {
	type:        'factory';
	initializer: (container: Container) => any;
}
export interface DynamicBinding extends BaseBinding {
	type:        'dynamic';
	initializer: (container: Container) => any;
}
export interface ConstantBinding extends BaseBinding {
	type: 'constant';
}

export type Binding = ClassBinding | FactoryBinding | DynamicBinding | ConstantBinding;

export const isClassBinding = (binding: Binding): binding is ClassBinding => binding.type === 'class';
export const isFactoryBinding = (binding: Binding): binding is FactoryBinding => binding.type === 'factory';
export const isDynamicBinding = (binding: Binding): binding is DynamicBinding => binding.type === 'dynamic';
export const isConstantBinding = (binding: Binding): binding is ConstantBinding => binding.type === 'constant';


export class RegisterInitializer {

	constructor(protected binding: Binding) { }

	public class(ctor: ClassBinding['initializer']): RegisterSpesifierWithLifetime {
		this.binding.type = 'class';
		this.binding.initializer = ctor;

		return new RegisterSpesifierWithLifetime(this.binding);
	}

	public factory(factory: FactoryBinding['initializer']): RegisterSpesifierWithLifetime {
		this.binding.type = 'factory';
		this.binding.initializer = factory;

		return new RegisterSpesifierWithLifetime(this.binding);
	}

	public function(fn: DynamicBinding['initializer']): RegisterSpesifierWithLifetime {
		this.binding.type = 'dynamic';
		this.binding.initializer = fn;

		return new RegisterSpesifierWithLifetime(this.binding);
	}

	public constant(value: ConstantBinding['initializer']): RegisterSpesifier {
		this.binding.type = 'constant';
		this.binding.initializer = value;

		return new RegisterSpesifier(this.binding);
	}

}
export class RegisterLifetime {

	constructor(protected binding: Binding) { }

	public singleton(): void {
		this.binding.method = 'singleton';
	}

	public transient(): void {
		this.binding.method = 'transient';
	}

}
export class RegisterSpesifier {

	constructor(protected binding: Binding) { }

	public named(name: string): RegisterLifetime {
		this.binding.named = name;

		return new RegisterLifetime(this.binding);
	}

	public tagged(name: string, tag: string): RegisterLifetime {
		this.binding.named = name;
		this.binding.tagged = tag;

		return new RegisterLifetime(this.binding);
	}

}
export class RegisterSpesifierWithLifetime extends RegisterLifetime {

	public named(name: string): RegisterLifetime {
		this.binding.named = name;

		return new RegisterLifetime(this.binding);
	}

	public tagged(name: string, tag: string): RegisterLifetime {
		this.binding.named = name;
		this.binding.tagged = tag;

		return new RegisterLifetime(this.binding);
	}

}


export class Container {

	constructor(args?: { defaultLifetime?: Lifetimes; parent?: Container; }) {
		if (!args)
			return;

		const { defaultLifetime, parent } = args;
		if (defaultLifetime)
			this.defaultLifetime = defaultLifetime;
		if (parent)
			this.parent = parent;
	}

	public parent?:                          Container;
	public defaultLifetime:                  Lifetimes = 'singleton';
	public readonly id:                      string = nanoid();
	protected readonly bindings:             Map<Identifier, Binding[]> = new Map();
	protected readonly moduleIdToIdentifier: Map<string, Identifier[]> = new Map();

	public load(...modules: ContainerModule[]): void {
		for (const module of modules)
			module.registrator({ bind: (identifier) => this.createBind(identifier, module.id) });
	}

	public unload(...modules: ContainerModule[]): void {
		for (const module of modules) {
			const identifiers = this.moduleIdToIdentifier.get(module.id);
			if (!identifiers)
				continue;

			for (const identifier of identifiers) {
				const bindings = this.bindings.get(identifier);
				if (!bindings)
					continue;

				for (let i = bindings.length - 1; i >= 0; i--)
					bindings[i]!.moduleId === module.id && bindings.splice(i, 1);
			}
		}
	}

	public bind(identifier: Identifier): RegisterInitializer {
		return this.createBind(identifier);
	}

	public bindOnce(identifier: Identifier): RegisterInitializer | undefined {
		if (this.exists(identifier))
			return undefined;

		return this.bind(identifier);
	}

	public rebind(identifier: Identifier): RegisterInitializer {
		if (this.has(identifier))
			this.unbind(identifier);

		return this.bind(identifier);
	}

	public unbind(identifier: Identifier): void {
		this.bindings.delete(identifier);
	}

	/** Clears all bindings and references held by this container. */
	public unbindAll(): void {
		this.bindings.clear();
		this.moduleIdToIdentifier.clear();
	}

	/** Returns true or false if this `Container` has the requested `Identifier` */
	public has(identifier: Identifier): boolean {
		return this.bindings.has(identifier);
	}

	/** Returns true or false if this `Container` has the requested `Identifier` in itself or any of its parents */
	public exists(identifier: Identifier): boolean {
		const [ container ] = this.getBindings(identifier);

		return !!container;
	}

	public get<T>(identifier: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => !binding.named && !binding.tagged);

		AssertInjector.multiplePureBindings(container, bindings, identifier);

		return this.resolveSingleBinding(container, bindings[0]!);
	}

	public getNamed<T>(identifier: Identifier, name: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && !binding.tagged);

		AssertInjector.multipleNamedBindings(container, bindings, identifier, name);

		return this.resolveSingleBinding(container, bindings[0]!);
	}

	public getTagged<T>(identifier: Identifier, name: Identifier, tag: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && binding.tagged === tag);

		AssertInjector.multipleTaggedBindings(container, bindings, identifier, name, tag);

		return this.resolveSingleBinding(container, bindings[0]!);
	}

	public getAll<T>(identifier: Identifier): T[] {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => !binding.named && !binding.tagged);

		AssertInjector.missingPureBindings(container, bindings, identifier);

		return this.resolveAllBindings(container, bindings);
	}

	public getAllNamed<T>(identifier: Identifier, name: Identifier): T[] {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && !binding.tagged);

		AssertInjector.missingNamedBindings(container, bindings, identifier, name);

		return this.resolveAllBindings(container, bindings);
	}

	public getAllTagged<T>(identifier: Identifier, name: Identifier, tag: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && binding.tagged === tag);

		AssertInjector.missingTaggedBindings(container, bindings, identifier, name, tag);

		return this.resolveAllBindings(container, bindings);
	}

	public getLast<T>(identifier: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => !binding.named && !binding.tagged);

		AssertInjector.missingPureBindings(container, bindings, identifier);

		return this.resolveSingleBinding(container, bindings.at(-1)!);
	}

	public getLastNamed<T>(identifier: Identifier, name: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && !binding.tagged);

		AssertInjector.missingNamedBindings(container, bindings, identifier, name);

		return this.resolveSingleBinding(container, bindings.at(-1)!);
	}

	public getLastTagged<T>(identifier: Identifier, name: Identifier, tag: Identifier): T {
		const [ container, bindings ] = this.getBindings(identifier,
			binding => binding.named === name && binding.tagged === tag);

		AssertInjector.missingTaggedBindings(container, bindings, identifier, name, tag);

		return this.resolveSingleBinding(container, bindings.at(-1)!);
	}

	protected createBind(identifier: Identifier, moduleId?: string): RegisterInitializer {
		return new RegisterInitializer(
			this.addBinding(identifier, undefined, this.defaultLifetime, 'constant', moduleId),
		);
	}

	protected addBinding(
		identifier: Identifier,
		initializer: Binding['initializer'],
		method: Binding['method'],
		type: Binding['type'],
		moduleId?: string,
	): Binding {
		const bindings = this.bindings.get(identifier)
			?? this.bindings.set(identifier, []).get(identifier)!;

		const binding: Binding = { method, type, initializer, moduleId, cache: undefined };
		bindings.push(binding);

		if (moduleId) {
			const moduleIdentifiers = this.moduleIdToIdentifier.get(moduleId)
				?? this.moduleIdToIdentifier.set(moduleId, []).get(moduleId);

			moduleIdentifiers?.push(identifier);
		}

		return binding;
	}

	protected getBindings(
		identifier: Identifier,
		filter?: (binding: Binding) => boolean,
	): readonly [Container | undefined, Binding[]] {
		let bindings: Binding[] = [];
		let container: Container | undefined = this as Container;

		while (!bindings?.length && container) {
			if (container.bindings.has(identifier))
				bindings = container.bindings.get(identifier)!;

			if (!bindings?.length)
				container = container.parent;
		}

		if (filter)
			bindings = bindings.filter(filter);

		return [ container, bindings ] as const;
	}

	protected resolveSingleBinding(container: Container, binding: Binding): any {
		let instance: any;

		if (binding.method === 'transient') {
			instance = container.resolveBinding(binding);
		}
		else if (binding.method === 'singleton') {
			if (!binding?.cache)
				binding.cache = container.resolveBinding(binding);

			instance = binding.cache;
		}

		return instance;
	}

	protected resolveAllBindings(container: Container, bindings: Binding[]): any {
		return bindings.map(binding => this.resolveSingleBinding(container, binding));
	}

	protected resolveBinding(binding: Binding): any {
		if (isClassBinding(binding))
			return new binding.initializer(this);
		if (isFactoryBinding(binding))
			return binding.initializer(this);
		if (isDynamicBinding(binding))
			return binding.initializer(this);
		if (isConstantBinding(binding))
			return binding.initializer;

		throw new Error('Unsupported binding type: ' + (binding as any).type);
	}

}


class AssertInjector {

	public static missingPureBindings(
		container: Container | undefined, bindings: Binding[], id: Identifier,
	): asserts container {
		if (container && bindings.length)
			return;

		throw new Error('No pure bindings found for ' + String(id));
	}

	public static missingNamedBindings(
		container: Container | undefined, bindings: Binding[], id: Identifier, name: Identifier,
	): asserts container {
		if (container && bindings.length)
			return;

		throw new Error(`No named bindings found for ${ String(id) } with name ${ String(name) }`);
	}

	public static missingTaggedBindings(
		container: Container | undefined, bindings: Binding[], id: Identifier, name: Identifier, tag: Identifier,
	): asserts container {
		if (container && bindings.length)
			return;

		throw new Error(`No tagged bindings found for ${ String(id) } with name ${ String(name) } and tag ${ String(tag) }`);
	}

	public static multiplePureBindings(
		container: Container | undefined, bindings: Binding[], id: Identifier,
	): asserts container {
		if (container && bindings.length <= 1)
			return;

		this.missingPureBindings(container, bindings, id);
		throw new Error('Multiple pure bindings found for ' + String(id));
	}

	public static multipleNamedBindings(
		container: Container | undefined, bindings: Binding[], id: Identifier, name: Identifier,
	): asserts container {
		if (container && bindings.length <= 1)
			return;

		this.missingNamedBindings(container, bindings, id, name);
		throw new Error(`Multiple named bindings found for ${ String(id) } with name ${ String(name) }`);
	}

	public static multipleTaggedBindings(
		container: Container | undefined, bindings: Binding[], id: Identifier, name: Identifier, tag: Identifier,
	): asserts container {
		if (container && bindings.length <= 1)
			return;

		this.missingTaggedBindings(container, bindings, id, name, tag);
		throw new Error(`Multiple tagged bindings found for ${ String(id) } with name ${ String(name) } and tag ${ String(tag) }`);
	}

};


export class ContainerModule {

	public readonly id: string = nanoid();
	constructor(public registrator: (params: { bind: Container['bind']; }) => void) { }

}
