import { calendarMonth, dateKey } from './calendar-date';

class FolioCalendar extends HTMLElement {
	private cleanup?: () => void;

	connectedCallback() {
		if (this.cleanup) return;
		const heading = this.querySelector<HTMLTimeElement>('[data-calendar-month]');
		const table = this.querySelector<HTMLTableElement>('table');
		const body = this.querySelector<HTMLTableSectionElement>('tbody');
		if (!heading || !table || !body) return;
		const controller = new AbortController();
		const { signal } = controller;
		const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
		let today = new Date();
		let year = today.getFullYear(), month = today.getMonth();
		let followingToday = true;
		let midnightTimer = 0;

		function render() {
			const view = calendarMonth(year, month);
			year = view.year;
			month = view.month;
			const first = new Date(0);
			first.setUTCFullYear(year, month, 1);
			heading!.textContent = monthLabel.format(first);
			heading!.dateTime = dateKey(year, month, 1).slice(0, 7);
			heading!.setAttribute('aria-label', `${year}年${month + 1}月`);
			table!.setAttribute('aria-label', `${year}年${month + 1}月日历`);
			const current = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
			const fragment = document.createDocumentFragment();
			for (let week = 0; week < 6; week++) {
				const row = document.createElement('tr');
				for (const day of view.days.slice(week * 7, week * 7 + 7)) {
					const cell = document.createElement('td');
					const date = document.createElement('time');
					date.dateTime = day.key;
					date.textContent = String(day.day);
					date.setAttribute('aria-label', `${day.year}年${day.month + 1}月${day.day}日${day.key === current ? '，今天' : ''}`);
					if (!day.inMonth) cell.dataset.outside = '';
					if (day.key === current) date.setAttribute('aria-current', 'date');
					cell.append(date);
					row.append(cell);
				}
				fragment.append(row);
			}
			body!.replaceChildren(fragment);
		}
		function refreshDate() {
			today = new Date();
			if (followingToday) { year = today.getFullYear(); month = today.getMonth(); }
			render();
			window.clearTimeout(midnightTimer);
			const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
			midnightTimer = window.setTimeout(refreshDate, Math.max(1000, next.getTime() - today.getTime() + 100));
		}
		this.querySelector('[data-calendar-prev]')?.addEventListener('click', () => { followingToday = false; month--; render(); }, { signal });
		this.querySelector('[data-calendar-next]')?.addEventListener('click', () => { followingToday = false; month++; render(); }, { signal });
		this.querySelector('[data-calendar-today]')?.addEventListener('click', () => { followingToday = true; refreshDate(); }, { signal });
		document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDate(); }, { signal });
		window.addEventListener('pageshow', refreshDate, { signal });
		this.cleanup = () => { controller.abort(); window.clearTimeout(midnightTimer); };
		refreshDate();
	}

	disconnectedCallback() {
		this.cleanup?.();
		this.cleanup = undefined;
	}
}

if (!customElements.get('folio-calendar')) customElements.define('folio-calendar', FolioCalendar);
