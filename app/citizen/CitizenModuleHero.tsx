type CitizenModuleHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  badges: string[];
};

export default function CitizenModuleHero({ eyebrow, title, description, badges }: CitizenModuleHeroProps) {
  return <section className="ct-module-hero">
    <div className="ct-kicker">{eyebrow}</div>
    <h1>{title}</h1>
    <p>{description}</p>
    <div className="ct-hero-badges">{badges.map((badge) => <span key={badge}>{badge}</span>)}</div>
  </section>;
}
