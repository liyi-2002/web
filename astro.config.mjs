// @ts-check

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://liyizju.com',
	trailingSlash: 'always',
	redirects: {
		'/about': '/photography/',
		'/content': '/sharing/',
		'/content/[...slug]': '/notes/[...slug]',
	},
	integrations: [react(), mdx(), sitemap()],
});
