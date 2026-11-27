export type CalendarDay = { year: number; month: number; day: number; key: string; inMonth: boolean };

export function dateKey(year: number, month: number, day: number) {
	return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Monday-first, fixed six-week grid; UTC arithmetic avoids daylight-saving gaps. */
export function calendarMonth(year: number, month: number) {
	const first = new Date(0);
	first.setUTCHours(12, 0, 0, 0);
	first.setUTCFullYear(year, month, 1);
	const viewYear = first.getUTCFullYear();
	const viewMonth = first.getUTCMonth();
	const offset = (first.getUTCDay() + 6) % 7;
	const days: CalendarDay[] = Array.from({ length: 42 }, (_, index) => {
		const date = new Date(first);
		date.setUTCDate(1 - offset + index);
		const y = date.getUTCFullYear(), m = date.getUTCMonth(), d = date.getUTCDate();
		return { year: y, month: m, day: d, key: dateKey(y, m, d), inMonth: y === viewYear && m === viewMonth };
	});
	return { year: viewYear, month: viewMonth, days };
}
