import { buildSearchIndex, searchIndex, searchSectionLabels, type SearchEntry, type SearchFilter } from './search-index';

function isSearchEntry(value: unknown): value is SearchEntry {
	if (!value || typeof value !== 'object') return false;
	const entry = value as Partial<SearchEntry>;
	return typeof entry.id === 'string' && typeof entry.title === 'string'
		&& typeof entry.description === 'string' && typeof entry.href === 'string'
		&& (entry.date === undefined || typeof entry.date === 'string')
		&& (entry.section === 'sharing' || entry.section === 'notes' || entry.section === 'photography')
		&& Array.isArray(entry.tags) && entry.tags.every(tag => typeof tag === 'string');
}

class SiteSearch extends HTMLElement {
	private cleanup?: () => void;

	connectedCallback() {
		if (this.cleanup) return;
		const trigger = this.querySelector<HTMLButtonElement>('[data-search-open]');
		const dialog = this.querySelector<HTMLDialogElement>('dialog');
		const input = this.querySelector<HTMLInputElement>('[data-search-input]');
		const results = this.querySelector<HTMLUListElement>('[data-search-results]');
		const empty = this.querySelector<HTMLElement>('[data-search-empty]');
		const emptyTitle = this.querySelector<HTMLElement>('[data-search-empty-title]');
		const emptyCopy = this.querySelector<HTMLElement>('[data-search-empty-copy]');
		const count = this.querySelector<HTMLElement>('[data-search-count]');
		const scroll = this.querySelector<HTMLElement>('[data-search-scroll]');
		const filters = Array.from(this.querySelectorAll<HTMLButtonElement>('[data-search-filter]'));
		if (!trigger || !dialog || !input || !results || !empty || !emptyTitle || !emptyCopy || !count || !scroll) return;
		let entries: SearchEntry[] = [];
		try {
			const parsed: unknown = JSON.parse(this.querySelector('[data-search-index]')?.textContent || '[]');
			if (Array.isArray(parsed)) entries = parsed.filter(isSearchEntry).filter(entry => {
				try { return ['http:', 'https:'].includes(new URL(entry.href, location.href).protocol); } catch { return false; }
			});
		} catch { /* The empty state remains usable if content data is malformed. */ }
		const index = buildSearchIndex(entries);
		const controller = new AbortController();
		const { signal } = controller;
		let filter: SearchFilter = 'all';
		let opened = false;
		let previousFocus: HTMLElement | null = null;
		let savedOverflow = '';
		let debounce = 0;
		let composing = false;
		let backdropPressed = false;
		const byId = new Map(entries.map(entry => [entry.id, entry]));
		const shortcut = this.querySelector<HTMLElement>('[data-search-shortcut]');
		if (shortcut) shortcut.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

		function render() {
			window.clearTimeout(debounce);
			const matches = searchIndex(index, input!.value, filter);
			const query = input!.value.trim();
			const fragment = document.createDocumentFragment();
			for (const entry of matches.slice(0, 50)) {
				const li = document.createElement('li');
				const link = document.createElement('a');
				link.className = 'search-result';
				// Only ordinary web destinations can become result links.
				try {
					const url = new URL(entry.href, location.href);
					if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
					link.href = url.href;
				} catch { continue; }
				link.dataset.searchResult = entry.id;
				const meta = document.createElement('span');
				meta.className = 'search-result__meta';
				const section = document.createElement('span');
				section.textContent = searchSectionLabels[entry.section];
				meta.append(section);
				if (entry.date && Number.isFinite(Date.parse(entry.date))) {
					const date = document.createElement('time');
					date.dateTime = entry.date;
					date.textContent = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(entry.date));
					meta.append(date);
				}
				const title = document.createElement('span');
				title.className = 'search-result__title';
				title.textContent = entry.title;
				link.append(meta, title);
				if (entry.description) {
					const description = document.createElement('span');
					description.className = 'search-result__copy';
					description.textContent = entry.description;
					link.append(description);
				}
				li.append(link);
				fragment.append(li);
			}
			results!.replaceChildren(fragment);
			results!.hidden = !matches.length;
			empty!.hidden = Boolean(matches.length);
			if (!entries.length) {
				count!.textContent = '分享 · 手记 · 摄影';
				emptyTitle!.textContent = '内容还在整理中';
				emptyCopy!.textContent = '分享、手记和摄影发布后，会在这里出现。';
			} else if (!matches.length) {
				count!.textContent = '没有匹配结果';
				emptyTitle!.textContent = query ? '没有找到相关内容' : '这个栏目还没有内容';
				emptyCopy!.textContent = query ? '试试更短的关键词，或切换到「全部」。' : '可以切换到其他栏目，看看最近的记录。';
			} else {
				count!.textContent = `${query ? '找到' : '共'} ${matches.length} 条内容${matches.length > 50 ? '，显示前 50 条' : ''}`;
			}
			scroll!.scrollTop = 0;
			filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.searchFilter === filter)));
		}
		function finishClose() {
			if (!opened) return;
			opened = false;
			window.clearTimeout(debounce);
			document.documentElement.style.overflow = savedOverflow;
			trigger!.setAttribute('aria-expanded', 'false');
			document.dispatchEvent(new CustomEvent('folio:overlay', { detail: { open: false } }));
			if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true });
			previousFocus = null;
		}
		function close() {
			if (dialog!.open) dialog!.close();
			finishClose();
		}
		function open() {
			if (dialog!.open) { input!.focus(); input!.select(); return; }
			if (document.querySelector('dialog[open]')) return;
			previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;
			render();
			dialog!.showModal();
			opened = true;
			savedOverflow = document.documentElement.style.overflow;
			document.documentElement.style.overflow = 'hidden';
			trigger!.setAttribute('aria-expanded', 'true');
			document.dispatchEvent(new CustomEvent('folio:overlay', { detail: { open: true } }));
			input!.focus({ preventScroll: true });
			input!.select();
		}
		function outside(event: MouseEvent | PointerEvent) {
			const box = dialog!.getBoundingClientRect();
			return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
		}
		trigger.addEventListener('click', open, { signal });
		this.querySelector('[data-search-close]')?.addEventListener('click', close, { signal });
		dialog.addEventListener('close', finishClose, { signal });
		dialog.addEventListener('pointerdown', event => { backdropPressed = event.target === dialog && outside(event); }, { signal });
		dialog.addEventListener('click', event => { if (backdropPressed && event.target === dialog && outside(event)) close(); backdropPressed = false; }, { signal });
		input.addEventListener('compositionstart', () => { composing = true; }, { signal });
		input.addEventListener('compositionend', () => { composing = false; render(); }, { signal });
		input.addEventListener('input', () => {
			window.clearTimeout(debounce);
			if (!composing) debounce = window.setTimeout(render, 100);
		}, { signal });
		filters.forEach(button => button.addEventListener('click', () => {
			filter = button.dataset.searchFilter as SearchFilter;
			render();
		}, { signal }));
		results.addEventListener('click', event => {
			const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-search-result]') : null;
			if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
			const entry = byId.get(link.dataset.searchResult || '');
			if (!entry) return;
			event.preventDefault();
			close();
			const selected = new CustomEvent('folio:select-entry', { cancelable: true, detail: { id: entry.id, section: entry.section } });
			document.dispatchEvent(selected);
			if (!selected.defaultPrevented) location.assign(link.href);
		}, { signal });
		dialog.addEventListener('keydown', event => {
			if (event.isComposing || composing || event.ctrlKey || event.metaKey || event.altKey) return;
			if (event.key === 'Escape') { event.preventDefault(); close(); return; }
			const focused = document.activeElement;
			if (focused === input && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) render();
			const links = Array.from(results!.querySelectorAll<HTMLAnchorElement>('a[data-search-result]'));
			const selected = links.findIndex(link => link === focused);
			if (event.key === 'Enter' && focused === input) {
				render();
				const first = results!.querySelector<HTMLAnchorElement>('a[data-search-result]');
				if (first) { event.preventDefault(); first.click(); }
				return;
			}
			if (!links.length || (focused !== input && selected < 0)) return;
			let next: number | null = null;
			if (event.key === 'ArrowDown') next = selected < 0 ? 0 : (selected + 1) % links.length;
			if (event.key === 'ArrowUp') next = selected < 0 ? links.length - 1 : (selected - 1 + links.length) % links.length;
			if (event.key === 'Home' && selected >= 0) next = 0;
			if (event.key === 'End' && selected >= 0) next = links.length - 1;
			if (next !== null) { event.preventDefault(); links[next].focus({ preventScroll: true }); links[next].scrollIntoView({ block: 'nearest' }); }
		}, { signal });
		document.addEventListener('keydown', event => {
			if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
				if (document.querySelector('dialog[open]') && !dialog.open) return;
				event.preventDefault();
				open();
			}
		}, { signal });
		this.cleanup = () => { close(); controller.abort(); window.clearTimeout(debounce); };
		render();
	}

	disconnectedCallback() { this.cleanup?.(); this.cleanup = undefined; }
}

if (!customElements.get('site-search')) customElements.define('site-search', SiteSearch);
