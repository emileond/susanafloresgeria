import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { getAllPosts } from '../lib/blog'

export const Route = createFileRoute('/blog')({
  component: BlogPage,
})

function BlogPage() {
  const posts = getAllPosts()

  return (
    <div className="container mx-auto px-4 py-12">
      <header className="max-w-3xl mx-auto text-center mb-10">
        <h1 className="text-4xl font-bold mb-3">Blog</h1>
        <p className="text-base-content/80">
          Artículos y recursos para el cuidado de las personas mayores.
        </p>
      </header>

      {/* Nested route outlet for /blog/$slug */}
      <Outlet />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((p) => (
          <article key={p.slug} className="card bg-base-100 shadow">
            <div className="card-body">
              <time className="text-xs opacity-70" dateTime={p.date}>
                {new Date(p.date).toLocaleDateString('es-MX', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              <h2 className="card-title mt-1">{p.title}</h2>
              <p className="text-base-content/80">{p.excerpt}</p>
              <div className="card-actions justify-end">
                <Link to="/blog/$slug" params={{ slug: p.slug }} className="btn btn-ghost btn-sm">Leer más</Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link to="/" className="btn btn-primary">Volver al inicio</Link>
      </div>
    </div>
  )
}
