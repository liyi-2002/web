export const SITE_TITLE = "LiYi's Channel";
export const SITE_DESCRIPTION = 'Notes, projects, and photography by Li Yi.';

// Shared by static pages and the metadata used during chapter navigation.
export const PAGE_METADATA = {
	home: { title: SITE_TITLE, description: SITE_DESCRIPTION },
	sharing: {
		title: `Sharing · ${SITE_TITLE}`,
		description: 'Projects and resources shared by Li Yi.',
	},
	notes: {
		title: `Notes · ${SITE_TITLE}`,
		description: 'Personal notes and reflections by Li Yi.',
	},
	photography: {
		title: `Photography · ${SITE_TITLE}`,
		description: 'Photography and visual notes by Li Yi.',
	},
} as const;

export const SITE_SECTIONS = [
	{ key: 'home', label: '主页', href: '/', ...PAGE_METADATA.home },
	{ key: 'sharing', label: '分享', href: '/sharing/', ...PAGE_METADATA.sharing },
	{ key: 'notes', label: '手记', href: '/notes/', ...PAGE_METADATA.notes },
	{ key: 'photography', label: '摄影', href: '/photography/', ...PAGE_METADATA.photography },
] as const;
