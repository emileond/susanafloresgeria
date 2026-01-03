import {createFileRoute, Link, useParams} from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {getPostBySlug} from '../lib/blog'

export const Route = createFileRoute('/blog/$slug')({
    component: BlogPostPage,
})

function BlogPostPage() {
    const {slug} = useParams({from: '/blog/$slug'})
    const post = getPostBySlug(slug)

    if (!post) {
        return (
            <div className="container mx-auto px-4 py-12">
                <header className="max-w-3xl mx-auto text-center mb-10">
                    <h1 className="text-3xl font-bold mb-2">Artículo no encontrado</h1>
                    <p className="text-base-content/80">El enlace puede haber cambiado o el contenido no está
                        disponible.</p>
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

                <div className="prose prose-lg max-w-none prose-headings:scroll-mt-24 prose-img:rounded-xl">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: (props) => (
                                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-6 mb-4" {...props} />
                            ),
                            h2: (props) => (
                                <h2 className="text-2xl sm:text-3xl font-bold mt-10 mb-3" {...props} />
                            ),
                            h3: (props) => (
                                <h3 className="text-xl sm:text-2xl font-semibold mt-8 mb-3" {...props} />
                            ),
                            p: ({children}) => (
                                <p className="leading-8 text-base-content/90 my-6">{children}</p>
                            ),
                            a: (props) => (
                                <a className="text-primary underline-offset-4 hover:underline" {...props} />
                            ),
                            ul: ({children}) => (
                                <ul className="list-disc pl-6 my-6 space-y-2">{children}</ul>
                            ),
                            ol: ({children}) => (
                                <ol className="list-decimal pl-6 my-6 space-y-2">{children}</ol>
                            ),
                            li: ({children}) => (
                                <li className="marker:text-base-content/60">{children}</li>
                            ),
                            blockquote: ({children}) => (
                                <blockquote
                                    className="border-l-4 border-base-300 pl-4 italic text-base-content/70 my-6">
                                    {children}
                                </blockquote>
                            ),
                            hr: () => <hr className="my-10 border-base-300"/>,
                            img: (props) => (
                                <img className="rounded-xl my-6 shadow" {...props} />
                            ),
                            table: ({children}) => (
                                <div className="overflow-x-auto my-6">
                                    <table className="min-w-full border border-base-300">{children}</table>
                                </div>
                            ),
                            th: (props) => (
                                <th className="bg-base-200 text-left px-3 py-2 border-b border-base-300" {...props} />
                            ),
                            td: (props) => (
                                <td className="px-3 py-2 border-b border-base-300" {...props} />
                            ),
                            pre: ({children}) => (
                                <pre className="bg-base-200 rounded-lg p-4 overflow-auto my-6">{children}</pre>
                            ),
                            code: ({inline, className, children, ...rest}) => {
                                if (inline) {
                                    return (
                                        <code className="bg-base-200 rounded px-1.5 py-0.5 text-sm" {...rest}>
                                            {children}
                                        </code>
                                    )
                                }
                                return (
                                    <code className={className} {...rest}>
                                        {children}
                                    </code>
                                )
                            },
                        }}
                    >
                        {post.content}
                    </ReactMarkdown>
                </div>

                <hr className="my-8"/>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <p className="text-base-content/80">
                        ¿Desea una valoración geriátrica integral? Con gusto puedo ayudarle a crear un plan
                        personalizado para usted o su familiar.
                    </p>
                    <div className="flex gap-3">
                        <a href="#contacto" className="btn btn-primary">Agendar cita</a>
                        <Link to="/blog" className="btn btn-ghost">Más artículos</Link>
                    </div>
                </div>
            </div>
        </article>
    )
}
