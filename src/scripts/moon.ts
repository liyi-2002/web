import { lunarDate, moonPhase } from './moon-phase';

/** Procedural silver surface: no photograph, texture download, or tracking request. */
function paintMoon(canvas: HTMLCanvasElement, phase: number) {
	const context = canvas.getContext('2d');
	if (!context) return;
	const size = 160;
	canvas.width = canvas.height = size;
	const pixels = context.createImageData(size, size);
	const angle = phase * Math.PI * 2;
	const lightX = Math.sin(angle), lightZ = -Math.cos(angle);
	const seas = [[-.3, -.25, .29, .2], [.2, -.38, .2, .28], [.25, .02, .31, .21], [-.48, .17, .15, .22]];
	const craters = [[-.14, .5, .09], [.43, .36, .08], [-.42, -.46, .06], [.04, -.06, .04], [-.55, .4, .05], [.52, -.2, .045], [.05, .65, .04]];
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const nx = (x + .5) / size * 2 - 1, ny = (y + .5) / size * 2 - 1;
		const radius = Math.hypot(nx, ny);
		if (radius > 1) continue;
		const nz = Math.sqrt(1 - radius * radius);
		const lighting = Math.pow(Math.max(0, nx * lightX + nz * lightZ), .32);
		let texture = .94 + .025 * Math.sin(nx * 113 + Math.sin(ny * 83)) * Math.sin(ny * 137);
		for (const [cx, cy, rx, ry] of seas) {
			const distance = ((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2;
			texture -= .18 * Math.exp(-distance * 1.4);
		}
		for (const [cx, cy, r] of craters) {
			const distance = Math.hypot(nx - cx, ny - cy) / r;
			texture += .13 * Math.exp(-(((distance - 1) / .16) ** 2)) - .07 * Math.exp(-(distance ** 2) * 2);
		}
		const value = Math.max(0, Math.min(255, (25 + 224 * lighting) * texture));
		const offset = (y * size + x) * 4;
		pixels.data[offset] = value;
		pixels.data[offset + 1] = value * .995;
		pixels.data[offset + 2] = value * .975;
		pixels.data[offset + 3] = Math.min(1, (1 - radius) * size / 2) * 255;
	}
	context.putImageData(pixels, 0, 0);
}

class FolioMoon extends HTMLElement {
	private cleanup?: () => void;
	connectedCallback() {
		if (this.cleanup) return;
		const canvas = this.querySelector<HTMLCanvasElement>('canvas');
		if (!canvas) return;
		const controller = new AbortController();
		const { signal } = controller;
		let timer = 0;
		const update = () => {
			const date = new Date();
			const state = moonPhase(date);
			const lunar = lunarDate(date);
			const percent = Math.round(state.illumination * 100);
			this.querySelector('[data-moon-phase]')!.textContent = state.name;
			this.querySelector('[data-moon-fraction]')!.textContent = `≈${percent}%`;
			this.querySelector('[data-lunar-month]')!.textContent = lunar?.month || '';
			this.querySelector('[data-lunar-day]')!.textContent = lunar?.day || '';
			this.setAttribute('aria-label', `${state.name}，月面照明约 ${percent}%${lunar ? `，北京时间农历${lunar.month}${lunar.day}` : ''}`);
			this.title = '月相为近似示意（北向上）；农历按北京时间。';
			paintMoon(canvas, state.phase);
			window.clearTimeout(timer);
			// Refresh at the next half hour, also covering China Standard Time midnight.
			timer = window.setTimeout(update, 1800000 - date.getTime() % 1800000 + 100);
		};
		document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); }, { signal });
		window.addEventListener('pageshow', update, { signal });
		this.cleanup = () => { controller.abort(); window.clearTimeout(timer); };
		update();
	}
	disconnectedCallback() { this.cleanup?.(); this.cleanup = undefined; }
}

if (!customElements.get('folio-moon')) customElements.define('folio-moon', FolioMoon);
