export type SearchSection = 'sharing' | 'notes' | 'photography';
export type SearchEntry = {
	id: string;
	section: SearchSection;
	title: string;
	description: string;
	tags: string[];
	date?: string;
	href: string;
};
export type SearchFilter = SearchSection | 'all';

export const searchSectionLabels: Record<SearchSection, string> = { sharing: '分享', notes: '手记', photography: '摄影' };

export function normalizeSearch(value: string) {
	return value.normalize('NFKC').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

export function buildSearchIndex(entries: SearchEntry[]) {
	return entries.map(entry => ({
		entry,
		title: normalizeSearch(entry.title),
		tags: entry.tags.map(normalizeSearch),
		text: normalizeSearch([entry.title, entry.description, ...entry.tags].join(' ')),
		date: entry.date && Number.isFinite(Date.parse(entry.date)) ? Date.parse(entry.date) : 0,
	}));
}

export function searchIndex(index: ReturnType<typeof buildSearchIndex>, query: string, section: SearchFilter = 'all') {
	const phrase = normalizeSearch(query);
	const terms = phrase.split(' ').filter(Boolean);
	return index
		.filter(item => (section === 'all' || item.entry.section === section) && terms.every(term => item.text.includes(term)))
		.map(item => ({
			...item,
			score: !phrase ? 0 : (item.title === phrase ? 120 : item.title.startsWith(phrase) ? 70 : item.title.includes(phrase) ? 45 : 0)
				+ terms.reduce((sum, term) => sum + (item.title.includes(term) ? 12 : 0) + (item.tags.some(tag => tag.includes(term)) ? 20 : 0), 0),
		}))
		.sort((a, b) => b.score - a.score || b.date - a.date || a.entry.id.localeCompare(b.entry.id))
		.map(item => item.entry);
}
