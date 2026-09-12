import { ButtonIcon, SlidersIcon, TableIcon } from './Icons.jsx'

const icons = {
  buttons: ButtonIcon,
  sliders: SlidersIcon,
  table: TableIcon,
}

const SectionCard = ({ children, className = '', icon, title, ...sectionProps }) => {
  const Icon = icons[icon]

  return (
    <section className={`section-card ${className}`} {...sectionProps}>
      <div className="section-card__heading">
        <span className="section-card__line" />
        {Icon ? <Icon /> : null}
        <h2>{title}</h2>
        <span className="section-card__line" />
      </div>
      {children}
    </section>
  )
}

export default SectionCard
