type RGB = readonly [number, number, number];
type ParticleLights = {
	sources: HTMLCanvasElement[][];
	bloom: HTMLCanvasElement[];
};

const SIZE = 128;
const palettes: { highlight: RGB; halo: RGB }[] = [
	{ highlight: [255, 255, 254], halo: [246, 250, 255] },
	{ highlight: [255, 251, 239], halo: [235, 172, 102] },
	{ highlight: [253, 250, 255], halo: [179, 146, 225] },
];
const focusProfiles = [
	{ width: .056, peak: 1.08, halo: .25, haze: .034 },
	{ width: .105, peak: .78, halo: .23, haze: .032 },
	{ width: .205, peak: .44, halo: .16, haze: .026 },
];
let cached: ParticleLights | undefined;

function texture(color: number, focus: number, bloomOnly = false): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE;
	const context = canvas.getContext('2d');
	if (!context) return canvas;
	const pixels = context.createImageData(SIZE, SIZE);
	const palette = palettes[color];
	const profile = focusProfiles[focus];
	const coreFalloff = 1 / (2 * profile.width * profile.width);
	for (let y = 0; y < SIZE; y++) {
		for (let x = 0; x < SIZE; x++) {
			const px = (x + .5 - SIZE / 2) / (SIZE / 2);
			const py = (y + .5 - SIZE / 2) / (SIZE / 2);
			const radiusSquared = px * px + py * py;
			const radius = Math.sqrt(radiusSquared);
			// Fade the distant halo to zero before the edge of the sprite.
			const edge = Math.max(0, Math.min(1, (1 - radius) / .28));
			const vignette = edge * edge * (3 - 2 * edge);
			let core = 0;
			let halo: number;
			if (bloomOnly) {
				halo = .22 * Math.exp(-radiusSquared / .18) + .04 * Math.exp(-radiusSquared / .5);
			} else {
				core = profile.peak * Math.exp(-radiusSquared * coreFalloff);
				halo = profile.halo * Math.exp(-radiusSquared / .088) + profile.haze * Math.exp(-radiusSquared / .35);
				if (focus === 0) {
					// A faint, single optical streak; no cross-shaped star or hard outline.
					const along = px * .914 + py * .406;
					const across = py * .914 - px * .406;
					core += .075 * Math.exp(-(along * along / .13 + across * across / .00016));
				}
			}
			const alpha = Math.min(.99, core + halo) * vignette;
			// The source burns almost white; its chromatic character lives in the halo.
			const highlight = bloomOnly ? .18 : Math.min(1, core / (core + halo + .001) + .22 * Math.exp(-radiusSquared / .003));
			const offset = (y * SIZE + x) * 4;
			for (let channel = 0; channel < 3; channel++) {
				pixels.data[offset + channel] = palette.halo[channel] + (palette.highlight[channel] - palette.halo[channel]) * highlight;
			}
			pixels.data[offset + 3] = Math.round(alpha * 255);
		}
	}
	context.putImageData(pixels, 0, 0);
	return canvas;
}

/** Build once: white, amber and lavender sources at three focal depths, plus soft bloom. */
export function createParticleLights(): ParticleLights {
	if (!cached) {
		cached = {
			sources: palettes.map((_, color) => focusProfiles.map((_, focus) => texture(color, focus))),
			bloom: palettes.map((_, color) => texture(color, 0, true)),
		};
	}
	return cached;
}
