import { createParticleLights } from './particle-light';

type Particle = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	age: number;
	life: number;
	depth: number;
	phase: number;
	speed: number;
	size: number;
	color: number;
	chase: boolean;
	trail: number;
	active: boolean;
};

const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function mountParticleSwarm(canvas: HTMLCanvasElement): () => void {
	const context = canvas.getContext('2d', { alpha: true });
	if (!context) return () => {};
	const lights = createParticleLights();
	const illumination = { x: 0, y: 0, weights: [0, 0, 0] };
	const particles: Particle[] = [];
	const available: number[] = [];
	const pointer = { x: .32, y: .5, active: false };
	const attraction = { x: 0, y: 0 };
	const trail = Array.from({ length: 5 }, () => ({ x: 0, y: 0 }));
	let width = 1;
	let height = 1;
	let initialized = false;
	let disposed = false;
	let pageVisible = true;
	let frame: number | null = null;
	let lastTime = 0;
	let time = 0;
	let focus = 0;
	let emissionRate = 100;
	let emissionCredit = 0;
	let resizePending = false;
	let lastPublishedTarget = '';

	function spawn(particle: Particle, warm = 0) {
		// Uniformly sample the perimeter, just outside the visible area.
		const margin = 12 + Math.random() * 32;
		const edge = Math.random() * (width + height) * 2;
		if (edge < width) {
			particle.x = edge;
			particle.y = -margin;
		} else if (edge < width + height) {
			particle.x = width + margin;
			particle.y = edge - width;
		} else if (edge < width * 2 + height) {
			particle.x = edge - width - height;
			particle.y = height + margin;
		} else {
			particle.x = -margin;
			particle.y = edge - width * 2 - height;
		}
		const dx = attraction.x - particle.x;
		const dy = attraction.y - particle.y;
		const distance = Math.hypot(dx, dy) || 1;
		particle.life = 4 + Math.random() * 2.5;
		particle.age = warm * particle.life;
		particle.depth = Math.random();
		particle.phase = Math.random() * TAU;
		particle.speed = Math.max(45, (distance - 35) / (particle.life * .8));
		const color = Math.random();
		particle.color = color < .5 ? 0 : color < .77 ? 1 : 2;
		particle.size = 4.5 + particle.depth * particle.depth * (particle.depth > .9 ? 15 : 11);
		particle.chase = Math.random() < .42;
		particle.trail = Math.floor(Math.random() * trail.length);
		const bend = (Math.random() - .5) * .28;
		particle.vx = (dx / distance - dy / distance * bend) * particle.speed;
		particle.vy = (dy / distance + dx / distance * bend) * particle.speed;
		// Pre-fill with staggered, already travelling particles; subsequent births are at the edge.
		particle.x += dx * warm;
		particle.y += dy * warm;
		particle.active = true;
	}

	function resize() {
		resizePending = false;
		const oldWidth = width;
		const oldHeight = height;
		width = Math.max(1, canvas.clientWidth);
		height = Math.max(1, canvas.clientHeight);
		const dpr = Math.min(window.devicePixelRatio || 1, width < 720 ? 1.5 : 1.75);
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		context!.setTransform(dpr, 0, 0, dpr, 0, 0);
		const mobile = width < 720;
		const capacity = Math.round(clamp(width * height / 1400, mobile ? 240 : 560, mobile ? 340 : 800));
		emissionRate = mobile ? clamp(capacity / 3.5, 65, 95) : clamp(capacity / 3.6, 145, 210);
		attraction.x = initialized ? attraction.x * width / oldWidth : width * .32;
		attraction.y = initialized ? attraction.y * height / oldHeight : height * .5;
		for (const point of trail) {
			point.x = initialized ? point.x * width / oldWidth : attraction.x;
			point.y = initialized ? point.y * height / oldHeight : attraction.y;
		}
		for (const particle of particles) {
			particle.x *= width / oldWidth;
			particle.y *= height / oldHeight;
			particle.vx *= width / oldWidth;
			particle.vy *= height / oldHeight;
			particle.speed *= Math.sqrt((width * height) / (oldWidth * oldHeight));
		}
		particles.length = Math.min(particles.length, capacity);
		while (particles.length < capacity) {
			particles.push({ x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, depth: 0, phase: 0, speed: 0, size: 0, color: 0, chase: false, trail: 0, active: false });
		}
		if (!initialized) {
			const initialCount = Math.floor(capacity * .7);
			for (let index = 0; index < initialCount; index++) {
				spawn(particles[index], Math.random() * .82);
			}
		}
		available.length = 0;
		particles.forEach((particle, index) => { if (!particle.active) available.push(index); });
		initialized = true;
		canvas.dataset.particleCount = String(capacity);
	}

	function render(timestamp: number) {
		frame = null;
		if (disposed || !pageVisible || document.hidden) return;
		if (resizePending) resize();
		const dt = lastTime ? clamp((timestamp - lastTime) / 1000, 0, .04) : 1 / 60;
		lastTime = timestamp;
		time += dt;
		focus += ((pointer.active ? 1 : 0) - focus) * (1 - Math.exp(-dt * (pointer.active ? 12 : 2.2)));
		const restX = width * (.32 + Math.sin(time * .15) * .07);
		const restY = height * (.5 + Math.cos(time * .12) * .08);
		const desiredX = restX + (pointer.x * width - restX) * focus;
		const desiredY = restY + (pointer.y * height - restY) * focus;
		const follow = 1 - Math.exp(-dt * 16);
		attraction.x += (desiredX - attraction.x) * follow;
		attraction.y += (desiredY - attraction.y) * follow;
		// Different response times leave a moving wake when the pointer turns quickly.
		let previous = attraction;
		for (const point of trail) {
			const catchUp = 1 - Math.exp(-dt * 24);
			point.x += (previous.x - point.x) * catchUp;
			point.y += (previous.y - point.y) * catchUp;
			previous = point;
		}

		emissionCredit += dt * emissionRate;
		const births = Math.floor(emissionCredit);
		emissionCredit -= births;
		for (let index = 0; index < births && available.length > 0; index++) {
			spawn(particles[available.pop()!]);
		}
		context!.clearRect(0, 0, width, height);
		// Very broad, faint bloom follows the light actually present, not the pointer itself.
		const bloomSize = Math.min(330, width * .85);
		for (let color = 0; color < 3; color++) {
			context!.globalAlpha = Math.min(.12, illumination.weights[color] * .008);
			context!.drawImage(lights.bloom[color], illumination.x - bloomSize / 2, illumination.y - bloomSize / 2, bloomSize, bloomSize);
			illumination.weights[color] = 0;
		}
		let lightX = 0;
		let lightY = 0;
		let lightWeight = 0;
		for (let index = 0; index < particles.length; index++) {
			const particle = particles[index];
			if (!particle.active) continue;
			particle.age += dt;
			const distance = Math.hypot(attraction.x - particle.x, attraction.y - particle.y);
			const arrivalRadius = 8 + particle.depth * 9;
			if (distance <= arrivalRadius || particle.age >= particle.life) {
				particle.active = false;
				available.push(index);
				continue;
			}
			const target = particle.chase && pointer.active ? trail[particle.trail] : attraction;
			const dx = target.x - particle.x;
			const dy = target.y - particle.y;
			const targetDistance = Math.hypot(dx, dy) || 1;
			const nx = dx / targetDistance;
			const ny = dy / targetDistance;
			// Gentle sideways steering fades near the target; nothing orbits or piles up there.
			const bend = Math.sin(particle.phase + time * .65) * .19 * Math.min(1, distance / 180);
			const baseSpeed = particle.speed * (1 + .18 * (1 - Math.min(1, distance / 500)));
			const chasing = particle.chase && pointer.active;
			const speed = chasing
				? Math.min(1600, Math.max(baseSpeed * .8, targetDistance * (2.8 + particle.depth)))
				: baseSpeed;
			const steering = 1 - Math.exp(-dt * (chasing ? 10 + particle.depth * 4 : 5));
			particle.vx += ((nx - ny * bend) * speed - particle.vx) * steering;
			particle.vy += ((ny + nx * bend) * speed - particle.vy) * steering;
			particle.x += particle.vx * dt;
			particle.y += particle.vy * dt;
			const fadeIn = Math.min(1, particle.age / .45);
			const fadeAge = Math.min(1, (particle.life - particle.age) / .65);
			const fadeArrival = Math.min(1, Math.max(0, (distance - arrivalRadius) / 28));
			const shimmer = .9 + Math.sin(time * 1.3 + particle.phase) * .1;
			const alpha = (.68 + particle.depth * .3) * fadeIn * fadeAge * fadeArrival * shimmer;
			const focusLevel = particle.depth > .89 ? 2 : particle.depth < .22 || particle.depth > .76 ? 1 : 0;
			const sprite = lights.sources[particle.color][focusLevel];
			const size = particle.size * (focusLevel === 2 ? 1.6 : 1.1);
			const contribution = Math.max(0, 1 - distance / 150) * alpha;
			lightX += particle.x * contribution;
			lightY += particle.y * contribution;
			lightWeight += contribution;
			illumination.weights[particle.color] += contribution;
			if (chasing && speed > 260) {
				const wake = Math.min(.025, 18 / speed);
				context!.globalAlpha = alpha * .22;
				context!.drawImage(sprite, particle.x - particle.vx * wake - size / 2, particle.y - particle.vy * wake - size / 2, size, size);
			}
			context!.globalAlpha = alpha;
			context!.drawImage(sprite, particle.x - size / 2, particle.y - size / 2, size, size);
		}
		if (lightWeight > 0) {
			illumination.x = lightX / lightWeight;
			illumination.y = lightY / lightWeight;
		}
		context!.globalAlpha = 1;
		frame = requestAnimationFrame(render);
	}

	function start() {
		if (disposed || !pageVisible || document.hidden || frame !== null) return;
		lastTime = 0;
		frame = requestAnimationFrame(render);
	}
	function pause() {
		if (frame !== null) cancelAnimationFrame(frame);
		frame = null;
		lastTime = 0;
	}
	function onPointer(event: PointerEvent) {
		if (!event.isPrimary) return;
		pointer.x = clamp(event.clientX / width, 0, 1);
		pointer.y = clamp(event.clientY / height, 0, 1);
		pointer.active = true;
		const published = `${Math.round(pointer.x * 100)},${Math.round(pointer.y * 100)}`;
		if (published !== lastPublishedTarget) {
			canvas.dataset.swarmTarget = published;
			lastPublishedTarget = published;
		}
	}
	function releasePointer(event: PointerEvent) {
		if (event.pointerType === 'touch' || event.type === 'pointercancel' || (event.type === 'pointerout' && !event.relatedTarget)) {
			pointer.active = false;
		}
	}
	function blur() { pointer.active = false; }
	function visibility() { document.hidden ? pause() : start(); }
	function pageHide() { pageVisible = false; pause(); }
	function pageShow() { pageVisible = true; start(); }
	function onResize() { resizePending = true; start(); }
	const passive = { passive: true };
	window.addEventListener('pointermove', onPointer, passive);
	window.addEventListener('pointerdown', onPointer, passive);
	window.addEventListener('pointerup', releasePointer, passive);
	window.addEventListener('pointercancel', releasePointer, passive);
	window.addEventListener('pointerout', releasePointer, passive);
	window.addEventListener('blur', blur);
	window.addEventListener('resize', onResize, passive);
	window.addEventListener('pagehide', pageHide);
	window.addEventListener('pageshow', pageShow);
	document.addEventListener('visibilitychange', visibility);
	resize();
	canvas.dataset.swarm = 'ready';
	canvas.dataset.swarmMode = 'stream-follow';
	start();
	return () => {
		disposed = true;
		pause();
		window.removeEventListener('pointermove', onPointer);
		window.removeEventListener('pointerdown', onPointer);
		window.removeEventListener('pointerup', releasePointer);
		window.removeEventListener('pointercancel', releasePointer);
		window.removeEventListener('pointerout', releasePointer);
		window.removeEventListener('blur', blur);
		window.removeEventListener('resize', onResize);
		window.removeEventListener('pagehide', pageHide);
		window.removeEventListener('pageshow', pageShow);
		document.removeEventListener('visibilitychange', visibility);
		context!.clearRect(0, 0, width, height);
		delete canvas.dataset.swarm;
		delete canvas.dataset.swarmMode;
		delete canvas.dataset.particleCount;
		delete canvas.dataset.swarmTarget;
	};
}

