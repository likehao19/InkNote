// Animate once as content enters the viewport; content remains visible without JS.
if (
  !matchMedia('(prefers-reduced-motion: reduce)').matches &&
  'IntersectionObserver' in window
) {
  const reveal = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.08 },
  );
  document
    .querySelectorAll(
      '.section-heading, .feature-grid article, .format-grid article, .workflow > div, .workflow ol, .workflow-grid > div, .workflow-grid ol, .download-card, .faq-list details',
    )
    .forEach((element) => reveal.observe(element));
  const hero = document.querySelector('.hero');
  if (hero)
    new IntersectionObserver(([entry]) =>
      hero.classList.toggle('motion-paused', !entry.isIntersecting),
    ).observe(hero);
}
