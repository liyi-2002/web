import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			section: z.enum(['sharing', 'notes']).default('notes'),
			tags: z.array(z.string()).default([]),
			draft: z.boolean().default(false),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

const photography = defineCollection({
	loader: glob({ base: './src/content/photography', pattern: '**/*.json' }),
	schema: ({ image }) => z.object({
		title: z.string().min(1),
		image: image(),
		alt: z.string().min(1),
		description: z.string().default(''),
		date: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		camera: z.string().optional(),
		location: z.string().optional(),
		draft: z.boolean().default(false),
	}),
});

export const collections = { blog, photography };
