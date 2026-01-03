import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getPostBySlug } from '../lib/blog'

export const Route = createFileRoute('/blog/$slug')({
  component: BlogPostPage,
})

function BlogPostPage() {
  const { slug } = useParams({ from: '/blog/$slug' })
  const post = getPostBySlug(slug)

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-12">
        <header className="max-w-3xl mx-auto text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Artículo no encontrado</h1>
          <p className="text-base-content/80">El enlace puede haber cambiado o el contenido no está disponible.</p>
        </header>
        <div className="text-center">
          <Link to="/blog" className="btn btn-primary">Volver al blog</Link>
        </div>
      </div>
    )
  }

  return (
    <article className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <time className="text-xs opacity-70" dateTime={post.date}>
            {new Date(post.date).toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <h1 className="text-4xl font-bold mt-2">{post.title}</h1>
          {post.excerpt ? <p className="mt-4 text-base-content/80">{post.excerpt}</p> : null}
        </header>

        <div className="prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>

        <hr className="my-8" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-base-content/80">
            ¿Desea una valoración geriátrica integral? Con gusto puedo ayudarle a crear un plan
            personalizado para usted o su familiar.
          </p>
          <div className="flex gap-3">
            <a href="#contacto" className="btn btn-primary">Reservar cita</a>
            <Link to="/blog" className="btn btn-ghost">Más artículos</Link>
          </div>
        </div>
      </div>
    </article>
  )
}
