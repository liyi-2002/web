import {
	LinearFilter, Mesh, NoToneMapping, OrthographicCamera, PlaneGeometry,
	Scene, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector2, WebGLRenderer,
} from 'three';

/** Subtle depth parallax from a real photograph. This is deliberately a 2.5D backdrop. */
export function mountPhotographicLandscape(canvas: HTMLCanvasElement): () => void {
	let renderer: WebGLRenderer;
	try {
		renderer = new WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'low-power' });
	} catch {
		canvas.dataset.scene = 'fallback';
		return () => {};
	}
	const mobile = window.matchMedia('(max-width: 720px)').matches;
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const scene = new Scene();
	const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
	camera.position.z = 1;
	renderer.toneMapping = NoToneMapping;
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
	const target = new Vector2();
	const pointer = new Vector2();
	const cover = new Vector2(1, 1);
	const motion = new Vector2();
	let frame = 0;
	let lastTime = 0;
	let disposed = false;
	let lostContext = false;
	let ready = false;
	let shaderFailed = false;

	const photo = new TextureLoader().load(
		mobile ? '/landscape/wellington-stars-mobile.webp' : '/landscape/wellington-stars.webp',
		() => {
			if (disposed) return;
			ready = true;
			resize();
			resume();
		}, undefined,
		() => { if (!disposed) { dispose(); canvas.dataset.scene = 'fallback'; } },
	);
	photo.colorSpace = SRGBColorSpace;
	photo.minFilter = LinearFilter;
	photo.magFilter = LinearFilter;
	photo.generateMipmaps = false;
	const material = new ShaderMaterial({
		name: 'photographic-landscape-parallax',
		depthTest: false, depthWrite: false, toneMapped: false,
		uniforms: { uPhoto: { value: photo }, uCover: { value: cover }, uMotion: { value: motion } },
		vertexShader: /* glsl */ `
			varying vec2 vUv;
			void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
		`,
		fragmentShader: /* glsl */ `
			uniform sampler2D uPhoto;
			uniform vec2 uCover, uMotion;
			varying vec2 vUv;
			void main() {
				// Overscan reserves real pixels at every edge throughout the camera movement.
				vec2 uv = (vUv - .5) * uCover / 1.035 + .5;
				// The photograph moves as one plane, preserving its original shapes.
				// The independent foreground light particles supply the nearer depth layer.
				uv += uMotion * .42;
				gl_FragColor = vec4(texture2D(uPhoto, uv).rgb, 1.);
				#include <colorspace_fragment>
			}
		`,
	});
	const geometry = new PlaneGeometry(2, 2);
	scene.add(new Mesh(geometry, material));
	renderer.debug.onShaderError = () => { shaderFailed = true; };

	function resize() {
		if (disposed) return;
		const width = canvas.clientWidth || window.innerWidth;
		const height = canvas.clientHeight || window.innerHeight;
		const imageAspect = photo.image ? photo.image.width / photo.image.height : 1.5;
		const viewportAspect = width / height;
		cover.set(Math.min(viewportAspect / imageAspect, 1), Math.min(imageAspect / viewportAspect, 1));
		renderer.setSize(width, height, false);
		canvas.dataset.sceneTheme = 'photographic-wellington-stars';
		canvas.dataset.sceneMode = 'photo-depth-parallax';
		resume();
	}
	function render(now: number) {
		frame = 0;
		if (disposed || lostContext || document.hidden || !ready) return;
		const delta = Math.min(lastTime ? (now - lastTime) / 1000 : 1 / 60, .05);
		lastTime = now;
		pointer.lerp(target, 1 - Math.exp(-delta * 3.5));
		// Bound the movement in screen space, including narrow mobile crops.
		motion.set(pointer.x * cover.x * .008, pointer.y * cover.y * .005);
		try {
			renderer.render(scene, camera);
			if (shaderFailed) throw new Error('Photo backdrop shader compilation failed');
			canvas.dataset.scene = 'ready';
		} catch {
			dispose();
			canvas.dataset.scene = 'fallback';
			return;
		}
		// No perpetual WebGL loop while idle; the independent pointer particles remain animated.
		if (pointer.distanceToSquared(target) > .000001) frame = requestAnimationFrame(render);
	}
	function resume() {
		if (!frame && ready && !disposed && !lostContext && !document.hidden) {
			lastTime = 0;
			frame = requestAnimationFrame(render);
		}
	}
	function move(event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		const strength = reducedMotion.matches ? .35 : 1;
		target.set((event.clientX / window.innerWidth * 2 - 1) * strength,
			(1 - event.clientY / window.innerHeight * 2) * strength);
		resume();
	}
	function center() { target.set(0, 0); resume(); }
	function visibility() {
		cancelAnimationFrame(frame);
		frame = 0;
		if (!document.hidden) resume();
	}
	function lost(event: Event) {
		event.preventDefault();
		lostContext = true;
		cancelAnimationFrame(frame);
		frame = 0;
		canvas.dataset.scene = 'fallback';
	}
	function restored() { lostContext = false; shaderFailed = false; resize(); }
	function dispose() {
		if (disposed) return;
		disposed = true;
		cancelAnimationFrame(frame);
		window.removeEventListener('resize', resize);
		window.removeEventListener('pointermove', move);
		window.removeEventListener('blur', center);
		window.removeEventListener('pageshow', resume);
		document.removeEventListener('pointerleave', center);
		document.removeEventListener('visibilitychange', visibility);
		document.removeEventListener('astro:before-swap', dispose);
		canvas.removeEventListener('webglcontextlost', lost);
		canvas.removeEventListener('webglcontextrestored', restored);
		geometry.dispose(); material.dispose(); photo.dispose(); renderer.dispose();
		canvas.dataset.scene = 'disposed';
	}
	window.addEventListener('resize', resize, { passive: true });
	window.addEventListener('pointermove', move, { passive: true });
	window.addEventListener('blur', center);
	window.addEventListener('pageshow', resume);
	document.addEventListener('pointerleave', center);
	document.addEventListener('visibilitychange', visibility);
	document.addEventListener('astro:before-swap', dispose, { once: true });
	canvas.addEventListener('webglcontextlost', lost);
	canvas.addEventListener('webglcontextrestored', restored);
	resize();
	return dispose;
}
