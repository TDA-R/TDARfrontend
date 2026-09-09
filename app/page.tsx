import Link from 'next/link';
import { ArrowUpRight, Github, Mail } from 'lucide-react';

const playgrounds = [
  {
    number: '01',
    title: 'MapperAlgo',
    suffix: 'Playground',
    description: 'Load Mapper JSON examples, inspect connected clusters, and explore the graph in two or three dimensions.',
    href: '/mapper',
    accent: 'coral',
    details: ['Mapper graph', 'Interactive', 'R code integration'],
  },
  {
    number: '02',
    title: 'SimplicialComplex',
    suffix: 'Playground',
    description: 'Learn computational topology through boundaries, filtrations, persistence, zigzags, and Laplacian operators.',
    href: '/simplicial-complex',
    accent: 'mint',
    details: ['Complexes', 'Persistent homology', 'Laplacians'],
  },
];

export default function Home() {
  return (
    <main className="hub-page">
      <header className="hub-header">
        <Link className="hub-brand" href="https://github.com/TDA-R" aria-label="TDA-R home">
          <span>TDA-R</span>
        </Link>
      </header>

      <section className="hub-intro">
        <div className="hub-intro-main">
          <h1><em>Explore the shape of data</em></h1>
          <p>Select the <Link href="https://github.com/TDA-R/MapperAlgo"><b>Mapper</b></Link> or the <Link href="https://github.com/TDA-R/SimplicialComplex"><b>simplicial complexes</b></Link> workspace.</p>
        </div>

        <div className="hub-author-card">
          <span className="hub-author-kicker">AUTHOR &amp; PROJECT</span>
          <strong className="hub-author-name">Chi-Chien Wang</strong>
          <div className="hub-author-links">
            <a href="mailto:kennywang2003@gmail.com" className="hub-author-link" title="Contact via Email">
              <Mail size={15} />
              <span>kennywang2003@gmail.com</span>
            </a>
            <a href="https://github.com/TDA-R" target="_blank" rel="noopener noreferrer" className="hub-author-link" title="TDA-R GitHub Organization">
              <Github size={15} />
              <span>https://github.com/TDA-R</span>
            </a>
          </div>
        </div>
      </section>

      <section className="hub-menu" aria-label="TDA-R playgrounds">
        {playgrounds.map(({ number, title, suffix, description, href, accent, details }) => (
          <Link className={`hub-card hub-card-${accent}`} href={href} key={href}>
            <div className="hub-card-top">
              <span>{number}</span>
            </div>
            <div>
              <p>{title}</p>
              <h2>{suffix}</h2>
              <p className="hub-card-description">{description}</p>
            </div>
            <div className="hub-card-bottom">
              <ul>{details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
              <span className="hub-open">OPEN <ArrowUpRight size={18} /></span>
            </div>
          </Link>
        ))}
      </section>

      <footer className="hub-footer">
        <span>Official R package interactive website</span>
      </footer>
    </main>
  );
}
