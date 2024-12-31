import { html, LitElement } from 'lit';


class RootElement extends LitElement {

	public override connectedCallback(): void {
		super.connectedCallback();
		import('./async.ts').then(m => m.kake());
	}

	protected override render(): unknown {
		return html`
		<div>
			<h1>Hello, world!</h1>
			<p>This is a LitElement component.</p>
		</div>
		`;
	}

}
customElements.define('root-element', RootElement);
