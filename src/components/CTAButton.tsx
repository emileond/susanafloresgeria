import {Calendar} from 'healthicons-react'

export type CTAButtonProps = {
    icon?: React.ReactNode
    href?: string
    children?: React.ReactNode
    className?: string
    target?: string
    rel?: string
    onClick?: React.MouseEventHandler<HTMLElement>
}

/**
 * Reusable primary Call-To-Action button.
 *
 * Defaults to linking the contact section and the label "Agendar cita".
 * If `href` is provided, renders an anchor; otherwise renders a button.
 */
export default function CTAButton({
                                      icon,
                                      href = '#contacto',
                                      children = 'Agendar cita',
                                      className = '',
                                      target,
                                      rel,
                                      onClick,
                                  }: CTAButtonProps) {
    const classes = `btn btn-accent text-white font-medium ${className}`.trim()

    if (href) {
        return (
            <a href={href} className={classes} target={target} rel={rel} onClick={onClick as any}>
                {icon ? icon : <Calendar/>}
                {children}
            </a>
        )
    }

    return (
        <button className={classes} onClick={onClick as any}>
            {icon ? icon : <Calendar/>}
            {children}
        </button>
    )
}
