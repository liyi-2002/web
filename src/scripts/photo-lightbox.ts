export type Photo = {
	id: string;
	title: string;
	src: string;
	alt: string;
	description?: string;
	date?: string;
	camera?: string;
	location?: string;
};

type Swipe = { id: number; x: number; y: number; horizontal: boolean };
type SavedStyle = { element: HTMLElement; property: string; value: string; priority: string };

function readPhotos(value: unknown): Photo[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	return value.filter((photo): photo is Photo => {
		if (!photo || typeof photo !== 'object'
			|| !['id', 'title', 'src', 'alt'].every(key => typeof photo[key] === 'string')
			|| !photo.id.trim() || !photo.title.trim() || !photo.src.trim() || seen.has(photo.id)) return false;
		if (['description', 'date', 'camera', 'location'].some(key => photo[key] !== undefined && typeof photo[key] !== 'string')) return false;
		try {
			if (!['http:', 'https:'].includes(new URL(photo.src, document.baseURI).protocol)) return false;
		} catch { return false; }
		seen.add(photo.id);
		return true;
	});
}

class PhotoViewer extends HTMLElement {
	private cleanup?: () => void;

	connectedCallback() {
		if (this.cleanup) return;
		const dialog = this.querySelector<HTMLDialogElement>('dialog');
		const media = this.querySelector<HTMLElement>('[data-photo-media]');
		const imageHost = this.querySelector<HTMLElement>('[data-photo-image]');
		const state = this.querySelector<HTMLElement>('[data-photo-state]');
		const status = this.querySelector<HTMLElement>('[data-photo-status]');
		const title = this.querySelector<HTMLElement>('[data-photo-title]');
		const description = this.querySelector<HTMLElement>('[data-photo-description]');
		const metadata = this.querySelector<HTMLElement>('[data-photo-metadata]');
		const counter = this.querySelector<HTMLElement>('[data-photo-counter]');
		const previous = this.querySelector<HTMLButtonElement>('[data-photo-prev]');
		const next = this.querySelector<HTMLButtonElement>('[data-photo-next]');
		const close = this.querySelector<HTMLButtonElement>('[data-photo-close]');
		const retry = this.querySelector<HTMLButtonElement>('[data-photo-retry]');
		if (!dialog || !media || !imageHost || !state || !status || !title || !description || !metadata || !counter || !previous || !next || !close || !retry) return;
		let photos: Photo[];
		try { photos = readPhotos(JSON.parse(this.querySelector('[data-photo-library]')?.textContent || '[]')); }
		catch { photos = []; }
		const controller = new AbortController();
		const { signal } = controller;
		const dateFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' });
		let index = 0;
		let loadId = 0;
		let pendingImage: HTMLImageElement | null = null;
		let returnFocus: HTMLElement | null = null;
		let announcedOpen = false;
		let swipe: Swipe | null = null;
		const pointers = new Set<number>();
		let savedStyles: SavedStyle[] = [];

		function announceOverlay(open: boolean) {
			if (announcedOpen === open) return;
			announcedOpen = open;
			document.dispatchEvent(new CustomEvent('folio:overlay', { detail: { open } }));
		}
		function saveStyle(element: HTMLElement, property: string) {
			savedStyles.push({ element, property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) });
		}
		function lockScroll() {
			const scrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
			for (const element of [document.documentElement, document.body]) {
				saveStyle(element, 'overflow');
				element.style.overflow = 'hidden';
			}
			if (scrollbar > 0) {
				saveStyle(document.body, 'padding-right');
				document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
			}
		}
		function clearPending() {
			loadId++;
			if (pendingImage) { pendingImage.onload = null; pendingImage.onerror = null; }
			pendingImage = null;
		}
		function clearSwipe() {
			const old = swipe;
			swipe = null;
			if (old && media!.hasPointerCapture(old.id)) media!.releasePointerCapture(old.id);
		}
		function finishClose() {
			clearPending();
			clearSwipe();
			pointers.clear();
			imageHost!.replaceChildren();
			media!.setAttribute('aria-busy', 'false');
			for (const saved of savedStyles.reverse()) {
				if (saved.value) saved.element.style.setProperty(saved.property, saved.value, saved.priority);
				else saved.element.style.removeProperty(saved.property);
			}
			savedStyles = [];
			announceOverlay(false);
			if (returnFocus?.isConnected && !returnFocus.closest('[inert]') && !document.querySelector('dialog[open]')) returnFocus.focus({ preventScroll: true });
			returnFocus = null;
		}
		function renderPhoto() {
			const photo = photos[index];
			if (!photo || !dialog!.open) return;
			clearPending();
			const request = loadId;
			title!.textContent = photo.title;
			description!.textContent = photo.description || '';
			description!.hidden = !photo.description?.trim();
			counter!.textContent = `${index + 1} / ${photos.length}`;
			previous!.disabled = next!.disabled = photos.length < 2;
			metadata!.replaceChildren();
			const details: { label: string; value: string }[] = [];
			if (photo.date) {
				const date = new Date(photo.date);
				if (Number.isFinite(date.getTime())) details.push({ label: '拍摄日期', value: dateFormat.format(date) });
			}
			if (photo.location?.trim()) details.push({ label: '地点', value: photo.location });
			if (photo.camera?.trim()) details.push({ label: '相机', value: photo.camera });
			for (const detail of details) {
				const item = document.createElement('li');
				item.textContent = detail.value;
				item.setAttribute('aria-label', `${detail.label}：${detail.value}`);
				metadata!.append(item);
			}
			metadata!.hidden = details.length === 0;
			imageHost!.replaceChildren();
			state!.hidden = false;
			status!.textContent = '正在加载照片…';
			retry!.hidden = true;
			if (document.activeElement === retry) close!.focus({ preventScroll: true });
			media!.setAttribute('aria-busy', 'true');
			const image = new Image();
			pendingImage = image;
			image.alt = photo.alt;
			image.decoding = 'async';
			image.draggable = false;
			image.onload = async () => {
				try { await image.decode(); } catch { /* A loaded image can still be displayed if decode is unsupported. */ }
				if (request !== loadId || !dialog!.open || signal.aborted) return;
				imageHost!.replaceChildren(image);
				state!.hidden = true;
				status!.textContent = '';
				media!.setAttribute('aria-busy', 'false');
				pendingImage = null;
			};
			image.onerror = () => {
				if (request !== loadId || !dialog!.open || signal.aborted) return;
				status!.textContent = '照片暂时无法加载，请重试或浏览其他照片。';
				retry!.hidden = false;
				media!.setAttribute('aria-busy', 'false');
				pendingImage = null;
			};
			image.src = photo.src;
		}
		function step(direction: number) {
			if (!dialog!.open || photos.length < 2) return;
			index = (index + direction + photos.length) % photos.length;
			renderPhoto();
		}
		function openPhoto(id: unknown) {
			if (typeof id !== 'string') return;
			const target = photos.findIndex(photo => photo.id === id);
			if (target < 0 || document.querySelector('dialog[open]') && !dialog!.open) return;
			index = target;
			if (!dialog!.open) {
				returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
				dialog!.showModal();
				lockScroll();
				announceOverlay(true);
				close!.focus({ preventScroll: true });
			}
			renderPhoto();
		}

		document.addEventListener('folio:open-photo', event => { if (event instanceof CustomEvent) openPhoto(event.detail?.id); }, { signal });
		previous.addEventListener('click', () => step(-1), { signal });
		next.addEventListener('click', () => step(1), { signal });
		retry.addEventListener('click', renderPhoto, { signal });
		close.addEventListener('click', () => dialog.close(), { signal });
		dialog.addEventListener('close', finishClose, { signal });
		dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); }, { signal });
		dialog.addEventListener('keydown', event => {
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			event.preventDefault();
			step(event.key === 'ArrowLeft' ? -1 : 1);
		}, { signal });
		dialog.addEventListener('pointerdown', event => {
			if (event.pointerType !== 'touch') return;
			pointers.add(event.pointerId);
			if (pointers.size > 1) clearSwipe();
		}, { signal, passive: true });
		media.addEventListener('pointerdown', event => {
			if (event.pointerType !== 'touch' || !dialog.open) return;
			pointers.add(event.pointerId);
			if (pointers.size > 1 || (window.visualViewport?.scale ?? 1) > 1.01) { clearSwipe(); return; }
			if (event.target instanceof Element && event.target.closest('button')) return;
			swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
		}, { signal, passive: true });
		media.addEventListener('pointermove', event => {
			if (!swipe || swipe.id !== event.pointerId || pointers.size !== 1) return;
			if ((window.visualViewport?.scale ?? 1) > 1.01) { clearSwipe(); return; }
			const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
			if (!swipe.horizontal) {
				if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { clearSwipe(); return; }
				if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
				swipe.horizontal = true;
				media.setPointerCapture(event.pointerId);
			}
			if (event.cancelable) event.preventDefault();
		}, { signal, passive: false });
		media.addEventListener('pointerup', event => {
			pointers.delete(event.pointerId);
			if (swipe?.id !== event.pointerId) return;
			const dx = event.clientX - swipe.x;
			const advance = swipe.horizontal && Math.abs(dx) >= Math.min(64, Math.max(36, media.clientWidth * .09));
			clearSwipe();
			if (advance) step(dx < 0 ? 1 : -1);
		}, { signal });
		media.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); clearSwipe(); }, { signal });
		media.addEventListener('lostpointercapture', event => { if (swipe?.id === event.pointerId) clearSwipe(); }, { signal });
		for (const eventName of ['pointerup', 'pointercancel'] as const) {
			window.addEventListener(eventName, event => {
				pointers.delete(event.pointerId);
				if (swipe?.id === event.pointerId) clearSwipe();
			}, { signal });
		}
		media.addEventListener('dragstart', event => event.preventDefault(), { signal });
		window.addEventListener('pagehide', () => { if (dialog.open) dialog.close(); }, { signal });
		this.cleanup = () => {
			controller.abort();
			if (dialog.open) dialog.close();
			finishClose();
		};
	}

	disconnectedCallback() { this.cleanup?.(); this.cleanup = undefined; }
}

if (!customElements.get('photo-viewer')) customElements.define('photo-viewer', PhotoViewer);
