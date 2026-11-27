// Empty, movable surfaces; content can be assigned to a card without changing its layout.
export const folioCards = {
	home: [
		{ id: 'letter', shape: 'pinned', tone: 'mist', label: '最近更新' },
		{ id: 'postcard', shape: 'pinned', tone: 'pearl', label: '日历' },
		{ id: 'bookmark', shape: 'bookmark', tone: 'pearl', label: '月相与农历' },
	],
} as const;
