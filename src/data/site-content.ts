import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';

export type ContentSection = 'sharing' | 'notes' | 'photography';
export type SiteEntry = {
	id: string;
	section: ContentSection;
	title: string;
	description: string;
	tags: string[];
	date: Date;
	updated: Date;
	href: string;
	photo?: { src: string; thumbnail: string; alt: string; width: number; height: number; camera?: string; location?: string };
};

/** One published catalogue feeds the cards, search and recent updates. */
export async function getSiteContent(): Promise<SiteEntry[]> {
	const [posts, photos] = await Promise.all([
		getCollection('blog', ({ data }) => !data.draft),
		getCollection('photography', ({ data }) => !data.draft),
	]);
	const articles: SiteEntry[] = posts.map(({ id, data }) => ({
		id: `${data.section}/${id}`, section: data.section, title: data.title,
		description: data.description, tags: data.tags, date: data.pubDate,
		updated: data.updatedDate ?? data.pubDate, href: `/${data.section}/${id}/`,
	}));
	const images: SiteEntry[] = await Promise.all(photos.map(async ({ id, data }) => {
		const [full, thumbnail] = await Promise.all([
			getImage({ src: data.image, width: Math.min(2400, data.image.width), format: 'webp', quality: 90 }),
			getImage({ src: data.image, width: Math.min(640, data.image.width), format: 'webp', quality: 82 }),
		]);
		return {
			id: `photography/${id}`, section: 'photography', title: data.title,
			description: data.description, tags: data.tags, date: data.date,
			updated: data.updatedDate ?? data.date, href: full.src,
			photo: { src: full.src, thumbnail: thumbnail.src, alt: data.alt, width: data.image.width, height: data.image.height, camera: data.camera, location: data.location },
		};
	}));
	return [...articles, ...images].sort((a, b) => b.updated.valueOf() - a.updated.valueOf() || a.id.localeCompare(b.id));
}
