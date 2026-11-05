/**
 * Datos del sitio en un solo lugar.
 * Cambie aquí correo, horarios, dirección, etc. y se actualizan en todas las páginas.
 *
 * Las citas se agendan únicamente a través de Doctoralia (no se muestran teléfono ni WhatsApp).
 * ⚠️  Los valores marcados con TODO son provisionales y deben confirmarse antes de publicar.
 */

export const site = {
  url: 'https://susanafloresgeria.com', // TODO: confirmar dominio definitivo (se usa para SEO y sitemap)
  name: 'Dra. Susana Flores Alonso',
  shortName: 'Dra. Susana Flores',
  specialty: 'Geriatra',
  tagline: 'Geriatría y envejecimiento saludable',
  city: 'León, Guanajuato',
  description:
    'Geriatra en León, Gto. Atención integral para personas mayores: memoria y demencias, caídas, revisión de medicamentos, enfermedades crónicas y cuidados paliativos. Consulta en consultorio, a domicilio y en línea.',

  email: 'contacto@susanafloresgeria.com',

  doctoralia: {
    url: 'https://www.doctoralia.com.mx/susana-flores-alonso/geriatra/leon',
    reviewsUrl: 'https://www.doctoralia.com.mx/susana-flores-alonso/geriatra/leon#profile-reviews',
    slug: 'susana-flores-alonso',
  },

  address: {
    clinic: 'Consultorio de Geriatría y Envejecimiento Saludable',
    street: 'Av. Panorama 905-A',
    neighborhood: 'Col. Valle del Campestre',
    city: 'León',
    state: 'Guanajuato',
    stateShort: 'Gto.',
    zip: '37160',
    country: 'MX',
  },

  // TODO: confirmar horario real
  hours: [
    { days: 'Lunes a viernes', time: '9:00 a 18:00' },
    { days: 'Sábado', time: '9:00 a 14:00' },
  ],

  credentials: {
    cedulas: ['11529865', '14059596'],
    education: [
      { title: 'Especialidad en Geriatría', school: 'Universidad Autónoma de Yucatán (UADY)' },
      { title: 'Médica Cirujana', school: 'Universidad Michoacana de San Nicolás de Hidalgo' },
    ],
    hospitals: ['Hospital General de Zona con UMF No. 21', 'Hospital General Regional No. 1'],
    languages: ['Español', 'Inglés'],
  },

  // Precios de referencia (perfil de Doctoralia). Actualmente NO se muestran en el sitio.
  pricing: {
    clinic: 800,
    home: 1250,
    online: '700 – 750',
  },
  payments: 'Efectivo, tarjeta de crédito o débito y transferencia.',
} as const;

export const mapsQuery = encodeURIComponent(
  `${site.address.street}, ${site.address.neighborhood}, ${site.address.zip} ${site.address.city}, ${site.address.state}`,
);
export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
export const mapsEmbedUrl = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;

export const nav = [
  { label: '¿Qué es un geriatra?', href: '/#geriatria' },
  { label: 'Servicios', href: '/#servicios' },
  { label: 'Sobre la doctora', href: '/#sobre-mi' },
  { label: 'Preguntas', href: '/#preguntas' },
  { label: 'Blog', href: '/blog/' },
];
