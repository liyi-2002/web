type Gesture = {
	id: number;
	startX: number;
	startY: number;
	startPhase: number;
	stride: number;
	lastPhase: number;
	lastTime: number;
	velocity: number;
	horizontal: boolean;
};

type Loop = {
	root: HTMLElement;
	panel: HTMLElement;
	track: HTMLElement;
	items: HTMLElement[];
	status: HTMLElement | null;
	widths: number[];
	heights: number[];
	width: number;
	height: number;
	stride: number;
	phase: number;
	motionFrom: number;
	motionStarted: number;
	motionDuration: number;
	hover: number;
	nextHoverAt: number;
	hoverLocked: boolean;
	pointerX: number;
	pointerY: number;
	pointerDown: boolean;
	pressedIndex: number | null;
	pressedCentered: boolean;
	goal: number | null;
	gesture: Gesture | null;
	measured: boolean;
	dirty: boolean;
	suppressClickUntil: number;
	announced: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const mod = (value: number, count: number) => ((value % count) + count) % count;
const isEditable = (target: EventTarget | null) => target instanceof Element
	&& Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));

/** Each chapter owns its phase; the surrounding folio continues to own its orbit. */
export function enableContentLoops(tray: HTMLElement): { pause(): void; refresh(): void; select(section: string, id: string): boolean } {
	const loops: Loop[] = [];
	for (const root of tray.querySelectorAll<HTMLElement>('[data-content-loop]')) {
		const track = root.querySelector<HTMLElement>('[data-loop-track]');
		const panel = root.closest<HTMLElement>('.tray-panel');
		if (!track || !panel) continue;
		loops.push({
			root, panel, track,
			items: Array.from(track.querySelectorAll<HTMLElement>('[data-loop-item]')),
			status: panel.querySelector<HTMLElement>('[data-loop-status]'),
			widths: [], heights: [], width: 0, height: 0, stride: 1, phase: 0, motionFrom: 0, motionStarted: 0, motionDuration: 260, hover: 0,
			nextHoverAt: 0, hoverLocked: false, pointerX: 0, pointerY: 0, pointerDown: false, pressedIndex: null, pressedCentered: false,
			goal: null, gesture: null, measured: false, dirty: false,
			suppressClickUntil: 0, announced: -1,
		});
	}
	const controller = new AbortController();
	const { signal } = controller;
	let paused = false;
	let blurred = false;
	let pageVisible = true;
	let disposed = false;
	let frame = 0;

	function active(loop: Loop) {
		return !disposed && !paused && !blurred && pageVisible && !document.hidden
			&& loop.measured && !loop.panel.hidden && !loop.panel.inert
			&& !loop.root.closest('[inert]') && !tray.hasAttribute('data-transitioning');
	}
	function bounded(loop: Loop, phase: number) {
		return loop.items.length > 1 ? phase : 0;
	}
	function selected(loop: Loop) {
		return loop.items.length ? mod(Math.round(loop.phase), loop.items.length) : -1;
	}
	function announce(loop: Loop) {
		const index = selected(loop);
		if (index === loop.announced) return;
		loop.announced = index;
		if (loop.status) loop.status.textContent = index < 0 ? '' : `第 ${index + 1} 张，共 ${loop.items.length} 张`;
	}
	function sphereMetrics(loop: Loop) {
		const cardWidth = Math.max(0, ...loop.widths);
		return {
			// Every entry has one position around the complete orbit, regardless of count.
			angleStep: Math.PI * 2 / Math.max(1, loop.items.length),
			radiusX: Math.max(0, loop.width * .40 - cardWidth * .40),
			radiusY: loop.height * .14,
			radiusZ: Math.min(loop.width * .25, loop.height * .32),
			perspective: Math.max(500, loop.height * 1.4),
		};
	}
	function draw(loop: Loop) {
		if (!loop.measured) return;
		const count = loop.items.length;
		const current = selected(loop);
		const { angleStep, radiusX, radiusY, radiusZ } = sphereMetrics(loop);
		loop.items.forEach((item, index) => {
			const angle = count > 1 ? (index - loop.phase) * angleStep : 0;
			const sin = Math.sin(angle);
			const depth = Math.cos(angle);
			const light = (depth + 1) / 2;
			const opacity = .3 + .7 * light * light;
			const width = loop.widths[index];
			const center = loop.width / 2 + radiusX * sin;
			const y = loop.height * (count > 1 ? .43 : .5) + (count > 1 ? radiusY * depth : 0) - loop.heights[index] / 2;
			const z = count > 1 ? radiusZ * depth : 0;
			// Real perspective supplies depth and scale; no cloning or edge teleporting.
			item.style.transformOrigin = '50% 50%';
			item.style.transform = `translate3d(${center - width / 2}px, ${y}px, ${z}px) rotateY(${-sin * 30}deg) rotateX(${(1 - depth) * 3}deg) rotateZ(${sin * 4}deg)`;
			item.style.opacity = String(opacity);
			item.style.zIndex = String(1 + Math.round(light * 100));
			// Exposed rear cards can be selected; the 3D stack handles occlusion.
			item.toggleAttribute('data-loop-current', index === current);
			item.querySelector('button')?.setAttribute('aria-pressed', String(index === current));
		});
		loop.root.dataset.loopReady = '';
		loop.dirty = false;
	}
	function releaseGesture(loop: Loop) {
		const gesture = loop.gesture;
		loop.gesture = null;
		if (!gesture) return;
		if (gesture.horizontal) loop.suppressClickUntil = performance.now() + 400;
		if (loop.root.hasPointerCapture(gesture.id)) loop.root.releasePointerCapture(gesture.id);
	}
	function stop(loop: Loop) {
		releaseGesture(loop);
		loop.hover = 0;
		loop.hoverLocked = false;
		loop.pointerDown = false;
		loop.pressedIndex = null;
		loop.goal = null;
	}
	function lockHover(loop: Loop, position?: { clientX: number; clientY: number }) {
		loop.hover = 0;
		loop.hoverLocked = true;
		if (position) { loop.pointerX = position.clientX; loop.pointerY = position.clientY; }
	}
	function nearestGoal(loop: Loop, index: number) {
		return index + Math.round((loop.phase - index) / loop.items.length) * loop.items.length;
	}
	function animateTo(loop: Loop, goal: number) {
		loop.motionFrom = loop.phase;
		loop.motionStarted = performance.now();
		loop.motionDuration = 240 + Math.min(160, Math.abs(goal - loop.phase) * 20);
		loop.goal = bounded(loop, goal);
		loop.dirty = true;
		wake();
	}
	function snap(loop: Loop) {
		const goal = bounded(loop, Math.round(loop.phase));
		if (Math.abs(goal - loop.phase) > .0005) animateTo(loop, goal);
		else {
			loop.goal = null;
			loop.phase = loop.items.length > 1 ? mod(goal, loop.items.length) : goal;
			announce(loop);
		}
		loop.dirty = true;
	}
	function measure(loop: Loop) {
		const width = loop.track.clientWidth;
		const height = loop.track.clientHeight;
		const widths = loop.items.map(item => item.offsetWidth);
		const heights = loop.items.map(item => item.offsetHeight);
		if (!width || !height || widths.some(value => value <= 0)) {
			loop.measured = false;
			return;
		}
		if (loop.gesture) { releaseGesture(loop); snap(loop); }
		loop.width = width;
		loop.height = height;
		loop.widths = widths;
		loop.heights = heights;
		const { angleStep, radiusX, radiusZ, perspective } = sphereMetrics(loop);
		loop.root.style.setProperty('--loop-perspective', `${perspective}px`);
		// Match front-of-sphere travel while keeping larger collections easy to swipe.
		loop.stride = Math.max(48, radiusX * angleStep * perspective / (perspective - radiusZ));
		loop.measured = true;
		draw(loop);
		announce(loop);
	}
	function needsFrame(loop: Loop) {
		return active(loop) && (loop.dirty || loop.goal !== null || loop.hover !== 0);
	}
	function wake() {
		if (!frame && loops.some(needsFrame)) {
			frame = requestAnimationFrame(tick);
		}
	}
	function tick(now: number) {
		frame = 0;
		for (const loop of loops) {
			if (!active(loop)) continue;
			if (!loop.gesture && loop.goal !== null) {
				// Rotate the complete sphere by one entry, with a clean stop at the front.
				const progress = clamp((now - loop.motionStarted) / loop.motionDuration, 0, 1);
				const eased = 1 - Math.pow(1 - progress, 3);
				loop.phase = loop.motionFrom + (loop.goal - loop.motionFrom) * eased;
				if (progress === 1) {
					loop.phase = loop.items.length > 1 ? mod(loop.goal, loop.items.length) : loop.goal;
					loop.goal = null;
					announce(loop);
				}
				loop.dirty = true;
			}
			if (!loop.gesture && loop.goal === null && loop.hover !== 0 && now >= loop.nextHoverAt) {
				step(loop, Math.sign(loop.hover));
				loop.nextHoverAt = now + 480 - Math.abs(loop.hover) * 180;
			}
			if (loop.dirty) draw(loop);
		}
		if (!frame && loops.some(needsFrame)) frame = requestAnimationFrame(tick);
	}
	function step(loop: Loop, direction: number) {
		if (!active(loop) || loop.items.length < 2) return;
		releaseGesture(loop);
		animateTo(loop, Math.round(loop.goal ?? loop.phase) + direction);
	}
	function hover(loop: Loop, event: PointerEvent) {
		if (event.pointerType === 'touch' || loop.gesture || loop.pointerDown || !active(loop)) return;
		// Layout changes can generate pointer events without any deliberate movement.
		if (loop.hoverLocked && Math.hypot(event.clientX - loop.pointerX, event.clientY - loop.pointerY) < 6) return;
		loop.hoverLocked = false;
		loop.pointerX = event.clientX;
		loop.pointerY = event.clientY;
		let direction = 0;
		const onControl = event.target instanceof Element && Boolean(event.target.closest('button:not(.content-loop__card), input, textarea, select'));
		const readingCard = document.activeElement instanceof Element
			&& document.activeElement.matches(':focus-visible')
			&& loop.items.some(item => item.contains(document.activeElement));
		if (!onControl && !readingCard && event.buttons === 0) {
			const rect = loop.root.getBoundingClientRect();
			const x = event.clientX - rect.left;
			const y = event.clientY - rect.top;
			if (rect.width > 0 && x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
				const position = x / rect.width * 2 - 1;
				direction = Math.abs(position) > .14 ? clamp(position, -1, 1) : 0;
			}
		}
		const previous = loop.hover;
		loop.hover = direction;
		if (direction !== 0 && Math.sign(direction) !== Math.sign(previous)) {
			step(loop, Math.sign(direction));
			loop.nextHoverAt = performance.now() + 480 - Math.abs(direction) * 180;
		}
		wake();
	}
	for (const loop of loops) {
		loop.root.style.touchAction = 'pan-y';
		loop.root.addEventListener('pointerenter', event => hover(loop, event), { signal });
		loop.root.addEventListener('pointerleave', () => { loop.hover = 0; loop.hoverLocked = false; wake(); }, { signal });
		loop.root.addEventListener('pointerdown', event => {
			if (!active(loop) || !event.isPrimary || event.button !== 0 || isEditable(event.target)) return;
			if (event.target instanceof Element && event.target.closest('button:not(.content-loop__card)')) return;
			loop.suppressClickUntil = 0;
			loop.pointerDown = true;
			const pressed = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-loop-item]') : null;
			const index = pressed ? loop.items.indexOf(pressed) : -1;
			loop.pressedIndex = index >= 0 ? index : null;
			loop.pressedCentered = index >= 0 && loop.goal === null && Math.abs(nearestGoal(loop, index) - loop.phase) < .025;
			lockHover(loop, event);
			loop.goal = null;
			// Freeze the card under the pointer until its click is resolved.
			if (event.pointerType === 'mouse' || loop.items.length < 2) return;
			const scale = loop.track.getBoundingClientRect().width / loop.width || 1;
			loop.gesture = {
				id: event.pointerId, startX: event.clientX, startY: event.clientY,
				startPhase: loop.phase, stride: loop.stride * scale,
				lastPhase: loop.phase, lastTime: performance.now(), velocity: 0, horizontal: false,
			};
		}, { signal });
		loop.root.addEventListener('pointermove', event => {
			const gesture = loop.gesture;
			if (!gesture || gesture.id !== event.pointerId) { hover(loop, event); return; }
			if (!active(loop)) { stop(loop); return; }
			const dx = event.clientX - gesture.startX;
			const dy = event.clientY - gesture.startY;
			if (!gesture.horizontal) {
				if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { releaseGesture(loop); snap(loop); wake(); return; }
				if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
				gesture.horizontal = true;
				loop.root.setPointerCapture(event.pointerId);
			}
			if (event.cancelable) event.preventDefault();
			const now = performance.now();
			const phase = bounded(loop, gesture.startPhase - dx / gesture.stride);
			const delta = Math.max(.008, (now - gesture.lastTime) / 1000);
			const speed = clamp((phase - gesture.lastPhase) / delta, -3.5, 3.5);
			gesture.velocity += (speed - gesture.velocity) * (1 - Math.exp(-delta * 18));
			gesture.lastPhase = loop.phase = phase;
			gesture.lastTime = now;
			loop.dirty = true;
			wake();
		}, { signal, passive: false });
		function finishGesture(event: PointerEvent, cancelled: boolean) {
			const gesture = loop.gesture;
			if (!gesture || gesture.id !== event.pointerId) return;
			releaseGesture(loop);
			if (!active(loop)) return;
			if (gesture.horizontal) {
				const momentum = cancelled || performance.now() - gesture.lastTime > 100 ? 0 : gesture.velocity * .16;
				animateTo(loop, Math.round(loop.phase + momentum));
			} else snap(loop);
			wake();
		}
		loop.root.addEventListener('pointerup', event => finishGesture(event, false), { signal });
		loop.root.addEventListener('pointercancel', event => finishGesture(event, true), { signal });
		loop.root.addEventListener('lostpointercapture', event => finishGesture(event, true), { signal });
		loop.root.addEventListener('click', event => {
			const pressedIndex = event.detail ? loop.pressedIndex : null;
			loop.pressedIndex = null;
			if (event.detail !== 0 && performance.now() < loop.suppressClickUntil) {
				event.preventDefault();
				event.stopPropagation();
				loop.suppressClickUntil = 0;
				return;
			}
			if (!active(loop) || !(event.target instanceof Element)) return;
			const targetItem = event.target.closest<HTMLElement>('[data-loop-item]');
			const index = pressedIndex ?? (targetItem ? loop.items.indexOf(targetItem) : -1);
			if (index < 0) { snap(loop); wake(); return; }
			const link = event.target.closest('a[href]');
			if (link && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
			lockHover(loop, event.detail ? event : undefined);
			const goal = nearestGoal(loop, index);
			const centered = pressedIndex !== null ? loop.pressedCentered : loop.goal === null && Math.abs(goal - loop.phase) < .025;
			// A content link opens only after its card has reached the front.
			if (link && centered && loop.items[index].contains(link)) {
				const photoId = link.getAttribute('data-photo-id');
				if (photoId) {
					event.preventDefault();
					event.stopPropagation();
					document.dispatchEvent(new CustomEvent('folio:open-photo', { detail: { id: photoId } }));
				}
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			releaseGesture(loop);
			animateTo(loop, goal);
		}, { signal, capture: true });
		loop.root.addEventListener('focusin', event => {
			if (!active(loop) || loop.gesture || loop.pointerDown || !(event.target instanceof Node)) return;
			const index = loop.items.findIndex(item => item.contains(event.target as Node));
			if (index < 0 || loop.items.length < 2) return;
			lockHover(loop);
			animateTo(loop, nearestGoal(loop, index));
		}, { signal });
		loop.root.addEventListener('keydown', event => {
			loop.pressedIndex = null;
			if (event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			if (!active(loop) || loop.items.length < 2) return;
			event.preventDefault();
			lockHover(loop);
			step(loop, event.key === 'ArrowLeft' ? -1 : 1);
		}, { signal });
	}
	window.addEventListener('pointerup', event => {
		for (const loop of loops) {
			if (!loop.pointerDown) continue;
			loop.pointerDown = false;
			if (!(event.target instanceof Node) || !loop.root.contains(event.target)) {
				loop.pressedIndex = null;
				if (active(loop)) snap(loop);
			}
		}
		wake();
	}, { signal });
	window.addEventListener('pointercancel', () => { loops.forEach(loop => { loop.pointerDown = false; loop.pressedIndex = null; }); }, { signal });
	function halt() {
		cancelAnimationFrame(frame);
		frame = 0;
		loops.forEach(stop);
	}
	function updateMeasurements() {
		if (disposed) return;
		loops.forEach(measure);
		for (const loop of loops) if (active(loop) && loop.goal === null && loop.hover === 0 && !loop.gesture) snap(loop);
		wake();
	}
	const observer = new ResizeObserver(updateMeasurements);
	for (const loop of loops) { observer.observe(loop.root); observer.observe(loop.track); }
	window.addEventListener('blur', () => { blurred = true; halt(); }, { signal });
	window.addEventListener('focus', () => { blurred = false; updateMeasurements(); }, { signal });
	window.addEventListener('pagehide', () => { pageVisible = false; halt(); }, { signal });
	window.addEventListener('pageshow', () => { pageVisible = true; updateMeasurements(); }, { signal });
	document.addEventListener('visibilitychange', () => { document.hidden ? halt() : updateMeasurements(); }, { signal });
	function dispose() {
		if (disposed) return;
		disposed = true;
		halt();
		observer.disconnect();
		controller.abort();
	}
	document.addEventListener('astro:before-swap', dispose, { signal, once: true });
	if (import.meta.hot) import.meta.hot.dispose(dispose);
	updateMeasurements();
	return {
		pause() { paused = true; halt(); },
		refresh() { paused = false; updateMeasurements(); },
		select(section, id) {
			const loop = loops.find(candidate => candidate.panel.dataset.page === section);
			if (!loop || !active(loop)) return false;
			const index = loop.items.findIndex(item => item.dataset.entryId === id);
			if (index < 0) return false;
			releaseGesture(loop);
			lockHover(loop);
			animateTo(loop, nearestGoal(loop, index));
			loop.items[index].querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true });
			return true;
		},
	};
}
