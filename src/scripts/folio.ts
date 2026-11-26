import { enableCardDragging } from './tray-drag';

type Destination = { page: HTMLElement; index: number; url: URL };
type Navigation = Destination & { push: boolean };

function mountGallery(stage: HTMLElement) {
	const tray = stage.querySelector<HTMLElement>('[data-content-tray]')!;
	const pages = Array.from(tray.querySelectorAll<HTMLElement>('[data-page]'));
	const viewport = tray.parentElement!;
	const rail = tray.querySelector<SVGSVGElement>('[data-orbit-rail]')!;
	const tethers = Array.from(rail.querySelectorAll<SVGGElement>('[data-orbit-tether]')).map(group => ({
		group,
		line: group.querySelector<SVGPathElement>('[data-orbit-connector]')!,
		node: group.querySelector<SVGGElement>('[data-orbit-node]')!,
		endpoint: group.querySelector<SVGCircleElement>('[data-orbit-endpoint]')!,
	}));
	const dragging = enableCardDragging(tray);
	let current = pages.findIndex(page => !page.hidden);
	let phase = current;
	let goal = current;
	let velocity = 0;
	let frame: number | null = null;
	let lastTime = 0;
	let target: Navigation | null = null;
	let restoreFocus = false;
	let width = tray.clientWidth;
	let height = tray.clientHeight;
	let radiusY = height * .53;
	let radiusX = 0;
	let connectorLength = 0;
	function measureOrbit() {
		width = tray.clientWidth;
		height = tray.clientHeight;
		const viewportStyle = getComputedStyle(viewport);
		const gutter = parseFloat(viewportStyle.paddingLeft);
		connectorLength = Math.min(36, gutter * .24);
		radiusX = Math.min(170, width * .28, gutter - connectorLength - 26);
		radiusY = height * Number(viewportStyle.getPropertyValue('--orbit-radius-y'));
		const centerX = -radiusX - connectorLength;
		const centerY = height / 2;
		const path = `M ${centerX} ${centerY - radiusY} A ${radiusX} ${radiusY} 0 0 1 ${centerX} ${centerY + radiusY}`;
		rail.querySelectorAll('[data-orbit-path]').forEach(line => line.setAttribute('d', path));
		rail.querySelectorAll<SVGGElement>('[data-rail-spark]').forEach(spark => {
			const angle = Number(spark.dataset.railSpark);
			spark.setAttribute('transform', `translate(${centerX + radiusX * Math.cos(angle)} ${centerY + radiusY * Math.sin(angle)})`);
		});
	}

	function destination(href: string): Destination | null {
		const url = new URL(href, location.href);
		if (url.origin !== location.origin) return null;
		const path = url.pathname.replace(/\/$/, '') || '/';
		const index = pages.findIndex(page => (page.dataset.href!.replace(/\/$/, '') || '/') === path);
		return index < 0 ? null : { page: pages[index], index, url };
	}
	function selectNavigation(index: number) {
		stage.querySelectorAll<HTMLAnchorElement>('.folio-nav a').forEach(link => {
			if (destination(link.href)?.index === index) link.setAttribute('aria-current', 'page');
			else link.removeAttribute('aria-current');
		});
	}
	function nearestPhase(index: number) {
		return index + Math.round((phase - index) / pages.length) * pages.length;
	}
	function drawOrbit() {
		pages.forEach((page, index) => {
			// All chapters stay on one wheel. A single phase moves them as a group.
			const angle = (index - phase) * Math.PI * 2 / pages.length;
			const cosine = Math.cos(angle);
			const sine = Math.sin(angle);
			const front = (cosine + 1) / 2;
			const scale = .42 + .58 * Math.pow(front, 1.9);
			const tilt = sine * 8 * Math.PI / 180;
			const nodeX = -connectorLength + radiusX * (cosine - 1);
			const nodeY = height / 2 + radiusY * sine;
			const anchorX = nodeX + connectorLength;
			const anchorY = nodeY;
			// The left edge of each frame stays attached to its own point on the rail.
			const halfWidth = (width + 2) / 2;
			const x = anchorX + halfWidth * scale * Math.cos(tilt) - width / 2;
			const y = anchorY + halfWidth * scale * Math.sin(tilt) - height / 2;
			page.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) rotate(' + sine * 8 + 'deg) scale(' + scale + ')';
			page.style.opacity = String(Math.pow(front, 2.2));
			page.style.zIndex = String(Math.round(front * 1000));
			const tether = tethers[index];
			// The far side of the wheel passes behind the visible semicircle.
			const railVisibility = Math.min(1, Math.max(0, (cosine + .2) / .2));
			tether.group.style.opacity = String(Math.pow(front, 1.5) * railVisibility * railVisibility * (3 - 2 * railVisibility));
			tether.line.setAttribute('d', `M ${nodeX} ${nodeY} L ${anchorX} ${anchorY}`);
			tether.node.setAttribute('transform', `translate(${nodeX} ${nodeY})`);
			tether.endpoint.setAttribute('cx', String(anchorX));
			tether.endpoint.setAttribute('cy', String(anchorY));
		});
	}
	function setInteraction(index: number | null) {
		pages.forEach((page, pageIndex) => {
			page.hidden = false;
			page.inert = pageIndex !== index;
			page.setAttribute('aria-hidden', String(pageIndex !== index));
		});
	}
	function commit(next: Destination, push: boolean) {
		dragging.cancel();
		const active = document.activeElement;
		const moveFocus = tray.contains(active) || (restoreFocus && active === document.body);
		restoreFocus = false;
		if (frame !== null) cancelAnimationFrame(frame);
		frame = null;
		lastTime = 0;
		velocity = 0;
		current = next.index;
		phase = goal = nearestPhase(current);
		target = null;
		delete tray.dataset.transitioning;
		tray.removeAttribute('aria-busy');
		setInteraction(current);
		drawOrbit();
		dragging.reflow(next.page);
		stage.dataset.section = next.page.dataset.page;
		selectNavigation(current);
		document.title = next.page.dataset.title!;
		for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
			document.querySelector(selector)?.setAttribute('content', next.page.dataset.description || '');
		}
		document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
		const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
		if (canonical) {
			const url = new URL(canonical.href);
			url.pathname = next.url.pathname;
			canonical.href = url.href;
			document.querySelector('meta[property="og:url"]')?.setAttribute('content', url.href);
		}
		if (push && next.url.href !== location.href) history.pushState(history.state, '', next.url);
		stage.querySelector('[data-folio-status]')!.textContent = next.page.dataset.label!;
		if (moveFocus) stage.querySelector<HTMLElement>('.folio-nav a[aria-current]')?.focus({ preventScroll: true });
		if (next.url.hash) document.getElementById(decodeURIComponent(next.url.hash.slice(1)))?.scrollIntoView({ block: 'nearest' });
	}
	function tick(time: number) {
		frame = null;
		if (!target) return;
		// The analytic spring keeps real-time pacing even when the browser drops frames.
		const elapsed = Math.max(0, (time - lastTime) / 1000);
		lastTime = time;
		const frequency = 12;
		const displacement = phase - goal;
		const coefficient = velocity + frequency * displacement;
		const decay = Math.exp(-frequency * elapsed);
		phase = goal + (displacement + coefficient * elapsed) * decay;
		velocity = (velocity - frequency * coefficient * elapsed) * decay;
		drawOrbit();
		if (Math.abs(goal - phase) < .0006 && Math.abs(velocity) < .008) {
			const next = target;
			phase = goal;
			commit(next, next.push);
			return;
		}
		frame = requestAnimationFrame(tick);
	}
	function request(next: Destination, push = true) {
		if (target?.index === next.index) {
			target = { ...next, push };
			return;
		}
		if (!target && next.index === current) return;
		dragging.cancel();
		restoreFocus ||= tray.contains(document.activeElement);
		target = { ...next, push };
		goal = nearestPhase(next.index);
		setInteraction(null);
		dragging.reflow(next.page);
		selectNavigation(next.index);
		tray.dataset.transitioning = 'true';
		tray.setAttribute('aria-busy', 'true');
		// Chapter motion is always shown, including with reduced-motion enabled.
		if (frame === null) {
			lastTime = performance.now();
			frame = requestAnimationFrame(tick);
		}
	}
	document.addEventListener('click', event => {
		if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = event.target instanceof Element
			? event.target.closest<HTMLAnchorElement>('a[data-folio-link][href]') : null;
		if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
		const next = destination(link.href);
		if (!next) return;
		event.preventDefault();
		request(next);
	});
	window.addEventListener('popstate', () => {
		const next = destination(location.href);
		if (next) request(next, false);
	});
	window.addEventListener('pageshow', event => {
		if (!event.persisted) return;
		const next = destination(location.href);
		if (next) commit(next, false);
	});
	setInteraction(current);
	pages.forEach(page => dragging.reflow(page));
	measureOrbit();
	drawOrbit();
	new ResizeObserver(() => {
		measureOrbit();
		pages.forEach(page => dragging.reflow(page));
		drawOrbit();
	}).observe(tray);
}

const stage = document.querySelector<HTMLElement>('[data-folio]');
if (stage) mountGallery(stage);

