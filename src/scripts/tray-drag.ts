type Card = {
	wrapper: HTMLElement;
	paper: HTMLElement;
	x: number;
	y: number;
	width: number;
	height: number;
};

type Drag = {
	card: Card;
	pointerId: number;
	startX: number;
	startY: number;
	startOffsetX: number;
	startOffsetY: number;
	x: number;
	y: number;
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function enableCardDragging(tray: HTMLElement) {
	const cards = Array.from(tray.querySelectorAll<HTMLElement>('.tray-card-wrap')).map(wrapper => ({
		wrapper,
		paper: wrapper.querySelector<HTMLElement>('.tray-card')!,
		x: 0,
		y: 0,
		width: tray.clientWidth,
		height: tray.clientHeight,
	}));
	const byPaper = new Map(cards.map(card => [card.paper, card]));
	let drag: Drag | null = null;
	let frame: number | null = null;

	function position(card: Card, x: number, y: number) {
		card.x = x;
		card.y = y;
		// Independent translate keeps saved positions intact during the directory transition.
		card.wrapper.style.translate = x + 'px ' + y + 'px';
	}
	function limits(card: Card) {
		const paper = card.paper.getBoundingClientRect();
		const box = tray.getBoundingClientRect();
		const padding = 9;
		return {
			minX: card.x + box.left + padding - paper.left,
			maxX: card.x + box.right - padding - paper.right,
			minY: card.y + box.top + padding - paper.top,
			maxY: card.y + box.bottom - padding - paper.bottom,
		};
	}
	function bringToFront(card: Card) {
		const siblings = cards
			.filter(other => other.wrapper.parentElement === card.wrapper.parentElement && other !== card)
			.sort((a, b) => Number(a.wrapper.style.zIndex) - Number(b.wrapper.style.zIndex));
		siblings.forEach((other, index) => { other.wrapper.style.zIndex = String(index + 1); });
		card.wrapper.style.zIndex = String(siblings.length + 1);
	}
	function flush() {
		frame = null;
		if (drag) position(drag.card, drag.x, drag.y);
	}
	function finish(restore: boolean) {
		if (!drag) return;
		const stopped = drag;
		if (frame !== null) {
			cancelAnimationFrame(frame);
			frame = null;
		}
		position(stopped.card,
			restore ? stopped.startOffsetX : stopped.x,
			restore ? stopped.startOffsetY : stopped.y,
		);
		drag = null;
		delete stopped.card.wrapper.dataset.dragging;
		if (stopped.card.paper.hasPointerCapture(stopped.pointerId)) {
			stopped.card.paper.releasePointerCapture(stopped.pointerId);
		}
	}
	function reflow(page?: HTMLElement) {
		if (!page && tray.hasAttribute('data-transitioning')) return;
		finish(false);
		const pages = new Set(cards.map(card => card.wrapper.closest<HTMLElement>('[data-page]')!));
		for (const panel of pages) {
			if (panel.hidden || (page ? panel !== page : panel.inert)) continue;
			const transform = panel.style.getPropertyValue('transform');
			const priority = panel.style.getPropertyPriority('transform');
			// Paper bounds use the full-size frame, including when it is parked on the orbit.
			panel.style.setProperty('transform', 'none');
			try {
				for (const card of cards) {
					if (card.wrapper.closest('[data-page]') !== panel) continue;
					const x = card.width ? card.x * tray.clientWidth / card.width : 0;
					const y = card.height ? card.y * tray.clientHeight / card.height : 0;
					const bounds = limits(card);
					position(card, clamp(x, bounds.minX, bounds.maxX), clamp(y, bounds.minY, bounds.maxY));
					card.width = tray.clientWidth;
					card.height = tray.clientHeight;
				}
			} finally {
				if (transform) panel.style.setProperty('transform', transform, priority);
				else panel.style.removeProperty('transform');
			}
		}
	}
	function eventCard(event: Event) {
		const element = event.target instanceof Element ? event.target : null;
		if (!element || element.closest('[inert], .tray-content, a, button, input, textarea, select, [contenteditable]')) return;
		const paper = element.closest<HTMLElement>('.tray-card');
		return paper ? byPaper.get(paper) : undefined;
	}

	const layersByPage = new Map<HTMLElement, number>();
	cards.forEach(card => {
		const page = card.wrapper.closest<HTMLElement>('[data-page]')!;
		const layer = (layersByPage.get(page) ?? 0) + 1;
		layersByPage.set(page, layer);
		card.paper.tabIndex = 0;
		card.paper.dataset.draggable = '';
		card.paper.setAttribute('aria-describedby', 'paper-instructions');
		card.paper.setAttribute('aria-roledescription', '可移动卡纸');
		card.wrapper.style.zIndex = String(layer);
		if (card.paper.querySelector('.tray-content')) {
			card.paper.dataset.hasContent = '';
			for (const side of ['top', 'right', 'bottom', 'left']) {
				const edge = document.createElement('span');
				edge.className = 'tray-drag-edge tray-drag-edge--' + side;
				edge.setAttribute('aria-hidden', 'true');
				card.paper.append(edge);
			}
		}
	});
	tray.addEventListener('pointerdown', event => {
		if (drag || !event.isPrimary || event.button !== 0 || tray.hasAttribute('data-transitioning')) return;
		const card = eventCard(event);
		if (!card) return;
		event.preventDefault();
		bringToFront(card);
		card.paper.dataset.pointerFocus = '';
		card.paper.focus({ preventScroll: true });
		drag = {
			card,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			startOffsetX: card.x,
			startOffsetY: card.y,
			x: card.x,
			y: card.y,
			...limits(card),
		};
		card.wrapper.dataset.dragging = '';
		card.paper.setPointerCapture(event.pointerId);
	});
	tray.addEventListener('pointermove', event => {
		if (!drag || event.pointerId !== drag.pointerId) return;
		if (event.cancelable) event.preventDefault();
		drag.x = clamp(drag.startOffsetX + event.clientX - drag.startX, drag.minX, drag.maxX);
		drag.y = clamp(drag.startOffsetY + event.clientY - drag.startY, drag.minY, drag.maxY);
		if (frame === null) frame = requestAnimationFrame(flush);
	});
	tray.addEventListener('pointerup', event => {
		if (!drag || event.pointerId !== drag.pointerId) return;
		drag.x = clamp(drag.startOffsetX + event.clientX - drag.startX, drag.minX, drag.maxX);
		drag.y = clamp(drag.startOffsetY + event.clientY - drag.startY, drag.minY, drag.maxY);
		finish(false);
	});
	tray.addEventListener('pointercancel', event => {
		if (drag?.pointerId === event.pointerId) finish(true);
	});
	tray.addEventListener('lostpointercapture', event => {
		if (drag?.pointerId === event.pointerId) finish(false);
	});
	tray.addEventListener('focusin', event => {
		const card = eventCard(event);
		if (card && !tray.hasAttribute('data-transitioning')) bringToFront(card);
	});
	tray.addEventListener('dragstart', event => {
		if (eventCard(event)) event.preventDefault();
	});
	tray.addEventListener('keydown', event => {
		eventCard(event)?.paper.removeAttribute('data-pointer-focus');
		if (event.key === 'Escape' && drag) {
			event.preventDefault();
			finish(true);
			return;
		}
		const card = eventCard(event);
		if (!card || event.target !== card.paper || tray.hasAttribute('data-transitioning') || drag) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		const steps: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1],
		};
		const step = steps[event.key];
		if (!step) return;
		event.preventDefault();
		bringToFront(card);
		const distance = event.shiftKey ? 36 : 10;
		const bounds = limits(card);
		position(card,
			clamp(card.x + step[0] * distance, bounds.minX, bounds.maxX),
			clamp(card.y + step[1] * distance, bounds.minY, bounds.maxY),
		);
	});
	document.addEventListener('keydown', event => {
		if (event.key === 'Tab') cards.forEach(card => card.paper.removeAttribute('data-pointer-focus'));
	});
	window.addEventListener('blur', () => finish(false));
	window.addEventListener('pagehide', () => finish(false));
	document.addEventListener('scroll', () => finish(false), { capture: true, passive: true });
	const observer = new ResizeObserver(() => reflow());
	observer.observe(tray);
	reflow();
	return { cancel: () => finish(true), reflow };
}

