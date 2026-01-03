import {Link, Outlet} from '@tanstack/react-router'
import {createRootRoute} from '@tanstack/react-router'

export const Route = createRootRoute({
    component: RootComponent,
})

function RootComponent() {
    return (
        <div data-theme="corporate" className="min-h-screen flex flex-col bg-base-100 text-base-content">
            <Navbar/>
            <main className="flex-1">
                <Outlet/>
            </main>
            <SiteFooter/>
        </div>
    )
}

function Navbar() {
    return (
        <div className="navbar bg-base-100 shadow-sm sticky top-0 z-50">
            <div className="navbar-start">

                <Link to="/" className="btn btn-ghost normal-case text-xl">
                    <img src="/logo.svg" alt="logo" className="h-8"/>
                    Dra. Susana Flores
                </Link>
            </div>
            <div className="navbar-center hidden lg:flex">
                <ul className="menu menu-horizontal px-1">
                    <li><a href="#inicio">Inicio</a></li>
                    <li><a href="#servicios">Servicios</a></li>
                    <li><a href="#testimonios">Testimonios</a></li>
                    <li><a href="#faq">Preguntas</a></li>
                    <li><Link to="/blog">Blog</Link></li>
                    <li><a href="#contacto">Contacto</a></li>
                </ul>
            </div>
            <div className="navbar-end gap-2">
                <a href="#contacto" className="btn btn-primary">Agendar cita</a>
            </div>
        </div>
    )
}

function SiteFooter() {
    return (
        <footer className="footer bg-base-200 text-base-content p-10">
            <nav>
                <h6 className="footer-title">Consultorio Geriátrico</h6>
                <a className="link link-hover" href="#inicio">Inicio</a>
                <a className="link link-hover" href="#servicios">Servicios</a>
                <Link className="link link-hover" to="/blog">Blog</Link>
                <a className="link link-hover" href="#contacto">Contacto</a>
            </nav>
            <nav>
                <h6 className="footer-title">Contacto</h6>
                <a className="link link-hover" href="tel:+521555555555">+52 1 55 5555 5555</a>
                <a className="link link-hover" href="mailto:contacto@susanaflores.mx">contacto@susanaflores.mx</a>
                <a className="link link-hover" href="https://wa.me/5215555555555" target="_blank"
                   rel="noreferrer">WhatsApp</a>
            </nav>
            <nav>
                <h6 className="footer-title">Horario</h6>
                <p>Lun — Vie: 9:00 a 18:00</p>
                <p>Sáb: 9:00 a 14:00</p>
            </nav>
        </footer>
    )
}
