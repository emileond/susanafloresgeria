import frontMatter from 'front-matter'

export type BlogMeta = {
  slug: string
  title: string
  date: string // ISO yyyy-mm-dd
  excerpt?: string
}

export type BlogPost = BlogMeta & {
  content: string
}

// Load all markdown files under src/content/blog
const files = import.meta.glob('/src/content/blog/*.md', { as: 'raw', eager: true }) as Record<string, string>

function parseFile(path: string, raw: string): BlogPost {
  const parsed = frontMatter(raw)
  const data = parsed.attributes as Record<string, unknown>
  const content = parsed.body

  const slugFromFrontmatter = (data.slug || '').toString()
  // Fallback: derive slug from filename
  const filename = path.split('/').pop() || ''
  const slugFromFile = filename.replace(/\.md$/i, '')
  const slug = slugFromFrontmatter || slugFromFile

  return {
    slug,
    title: (data.title || slugFromFile).toString(),
    date: (data.date || '').toString(),
    excerpt: data.excerpt ? data.excerpt.toString() : undefined,
    content,
  }
}

const allPosts: BlogPost[] = Object.entries(files).map(([path, raw]) => parseFile(path, raw))

// Sort by date desc; invalid dates go last
allPosts.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0))

const mapBySlug = new Map(allPosts.map((p) => [p.slug, p]))

export function getAllPosts(): BlogMeta[] {
  return allPosts.map(({ content, ...meta }) => meta)
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return mapBySlug.get(slug)
}
