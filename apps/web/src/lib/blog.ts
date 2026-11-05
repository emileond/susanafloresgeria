import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

export async function getSortedPosts() {
  return (await getCollection('blog')).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function formatDate(date: Date) {
  // UTC para que la fecha del frontmatter no se recorra un día por zona horaria
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function readingTime(body = '') {
  return Math.max(1, Math.round(body.split(/\s+/).length / 200));
}

/** Artículos relacionados: primero los de la misma categoría, luego los más recientes. */
export function relatedPosts(post: Post, all: Post[], count = 3) {
  const others = all.filter((p) => p.id !== post.id);
  const same = others.filter((p) => p.data.category === post.data.category);
  const rest = others.filter((p) => p.data.category !== post.data.category);
  return [...same, ...rest].slice(0, count);
}
