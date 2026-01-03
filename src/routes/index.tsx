import {createFileRoute} from '@tanstack/react-router'
import {
    ElderlyOutline,
    BloodPressureMonitorOutline,
    MentalHealthOutline,
    RheumatologyOutline,
    MedicinesOutline,
    HospiceOutline
} from 'healthicons-react';
import DoctoraliaBooking from "../components/DoctoraliaBooking";
import CTAButton from "../components/CTAButton";
import {TbBrandWhatsapp} from "react-icons/tb";


export const Route = createFileRoute('/')({
    component: HomePage,
})

function HomePage() {
    return (
        <div id="inicio" className="bg-base-100">
            <HeroSection/>
            <AboutSection/>
            <ServicesSection/>
            <TestimonialsSection/>
            <FAQSection/>
            <ContactSection/>
        </div>
    )
}

function HeroSection() {
    return (
        <section className="hero bg-base-200">
            <div className="hero-content flex-col lg:flex-row-reverse gap-12 py-12">
                <img
                    src="/headshot.png"
                    alt="Dra. Susana Flores - Geriatra"
                    loading="eager"
                    className="max-w-sm mask mask-squircle shadow-2xl"
                    onError={(e) => {
                        // Hide image if not available yet
                        ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                />
                <div>
                    <h1 className="text-4xl md:text-5xl font-bold">
                        Atención geriátrica integral y humana
                    </h1>
                    <p className="py-6 text-lg text-base-content/80 max-w-prose">
                        Soy la Dra. Susana Flores, especialista en geriatría. Acompaño a las
                        personas mayores y a sus familias con un enfoque integral para mejorar su calidad de vida.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <CTAButton/>
                        <a
                            href="https://wa.me/5215555555555"
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-soft"
                        >
                            <span className="text-xl">

                            <TbBrandWhatsapp/>
                            </span>
                            WhatsApp
                        </a>
                    </div>
                </div>
            </div>
        </section>
    )
}

function AboutSection() {
    return (
        <section id="acerca" className="py-16 container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
                <div>
                    <h2 className="text-3xl font-bold mb-4">Acerca de mí</h2>
                    <p className="text-base-content/80 leading-relaxed mb-4">
                        Con más de 10 años de experiencia clínica, me enfoco en evaluar y
                        tratar de manera integral a las personas adultas mayores, atendiendo
                        condiciones como deterioro cognitivo, fragilidad, caídas,
                        polifarmacia y enfermedades crónicas.
                    </p>
                    <p className="text-base-content/80 leading-relaxed">
                        Trabajo en conjunto con la familia y cuidadores para diseñar planes
                        personalizados que promuevan autonomía, seguridad y bienestar.
                    </p>
                </div>
                <div className="stats shadow w-full">
                    <div className="stat">
                        <div className="stat-title">Años de experiencia</div>
                        <div className="stat-value">10+</div>
                    </div>
                    <div className="stat">
                        <div className="stat-title">Pacientes atendidos</div>
                        <div className="stat-value">1,200+</div>
                    </div>
                    <div className="stat">
                        <div className="stat-title">Satisfacción</div>
                        <div className="stat-value">98%</div>
                    </div>
                </div>
            </div>
        </section>
    )
}

function ServicesSection() {
    const services = [
        {
            icon: <ElderlyOutline/>,
            title: 'Valoración geriátrica integral',
            desc:
                'Evaluación completa del estado físico, cognitivo, emocional y social para un plan de cuidados personalizado.',
        },
        {
            icon: <BloodPressureMonitorOutline/>,
            title: 'Control de enfermedades crónicas',
            desc:
                'Manejo de diabetes, hipertensión, EPOC, insuficiencia cardíaca y otras condiciones frecuentes en el adulto mayor.',
        },
        {
            icon: <MentalHealthOutline/>,
            title: 'Memoria y demencias',
            desc:
                'Diagnóstico y abordaje de deterioro cognitivo, Alzheimer y otras demencias, con apoyo a familiares y cuidadores.',
        },
        {
            icon: <RheumatologyOutline/>,
            title: 'Prevención de caídas y fragilidad',
            desc:
                'Detección de riesgos, ejercicios terapéuticos y recomendaciones para mantener la movilidad y la independencia.',
        },
        {
            icon: <MedicinesOutline/>,
            title: 'Revisión de medicamentos (polifarmacia)',
            desc:
                'Optimización de tratamientos para evitar interacciones, efectos adversos y simplificar esquemas complejos.',
        },
        {
            icon: <HospiceOutline/>,
            title: 'Cuidados paliativos y soporte familiar',
            desc:
                'Acompañamiento centrado en confort, dignidad y control de síntomas, con orientación a la familia.',
        },
    ]

    return (
        <section id="servicios" className="py-16 bg-base-200">
            <div className="container mx-auto px-4">
                <h2 className="text-3xl font-bold mb-8 text-center">Servicios</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((s) => (
                        <div key={s.title} className="card bg-base-100 shadow">
                            <div className="card-body">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl text-secondary">
                                        {s.icon}
                                    </span>
                                    <h3 className="card-title">{s.title}</h3>
                                </div>
                                <p className="text-base-content/80">{s.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function TestimonialsSection() {
    const testimonials = [
        {
            name: 'María G.',
            text:
                'La doctora Susana fue muy clara y amable. Mi mamá mejoró su movilidad y ahora se siente más segura.',
        },
        {
            name: 'Jorge P.',
            text:
                'Excelente atención y seguimiento. Nos ayudó a entender el diagnóstico de Alzheimer y cómo cuidarlo en casa.',
        },
        {
            name: 'Lucía R.',
            text:
                'Muy profesional. Ajustó los medicamentos de mi abuelo y disminuyeron los mareos y caídas.',
        },
    ]

    return (
        <section id="testimonios" className="py-16 container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-8 text-center">Testimonios</h2>
            <div className="grid md:grid-cols-3 gap-6">
                {testimonials.map((t) => (
                    <div key={t.name} className="card bg-base-100 shadow">
                        <div className="card-body">
                            <p className="italic">“{t.text}”</p>
                            <div className="text-right font-semibold mt-4">— {t.name}</div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}

function FAQSection() {
    const faqs = [
        {
            q: '¿Atienden a domicilio?',
            a: 'Sí, ofrezco servicio a domicilio en zonas seleccionadas. Consúltame disponibilidad.',
        },
        {
            q: '¿Aceptan seguros?',
            a: 'Trabajo con reembolso y brindo factura para que puedas gestionar con tu aseguradora.',
        },
        {
            q: '¿Cómo preparo la primera consulta?',
            a: 'Trae identificación, lista de medicamentos, estudios recientes y antecedentes médicos relevantes.',
        },
    ]

    return (
        <section id="faq" className="py-16 bg-base-200">
            <div className="container mx-auto px-4">
                <h2 className="text-3xl font-bold mb-8 text-center">Preguntas frecuentes</h2>
                <div className="w-full max-w-3xl mx-auto">
                    {faqs.map((f, i) => (
                        <div key={i} className="collapse collapse-arrow join-item border border-base-300 bg-base-100">
                            <input type="checkbox"/>
                            <div className="collapse-title text-lg font-medium">{f.q}</div>
                            <div className="collapse-content">
                                <p className="text-base-content/80">{f.a}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function ContactSection() {
    return (
        <section id="contacto" className="py-16 container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-10">
                <div>
                    <h2 className="text-3xl font-bold mb-4">Agenda tu cita</h2>
                    <p className="text-base-content/80 mb-6">
                        Completa el formulario y me pondré en contacto a la brevedad para
                        confirmar tu cita. También puedes escribir por WhatsApp o llamar.
                    </p>
                    <div className="space-y-2">
                        <a className="link" href="tel:+521555555555">Tel: +52 1 55 5555 5555</a>
                        <br/>
                        <a className="link" href="mailto:contacto@susanaflores.mx">contacto@susanaflores.mx</a>
                        <br/>
                        <a className="link" href="https://wa.me/5215555555555" target="_blank"
                           rel="noreferrer">WhatsApp</a>
                    </div>
                </div>
                <DoctoraliaBooking/>
            </div>
        </section>
    )
}
