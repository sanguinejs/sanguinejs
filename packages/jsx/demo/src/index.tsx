import {  LitElement } from 'lit';


class RootElement extends LitElement {

	public override connectedCallback(): void {
		super.connectedCallback();
		import('./async.ts').then(m => m.kake());
	}

	protected override render(): unknown {
		return (
			<>
				<div>Hello there, yay it works</div>
			</>
		);
	}

}
customElements.define('root-element', RootElement);
