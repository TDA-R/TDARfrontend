'use client';

import { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Box,
  Braces,
  CircleDot,
  MoveRight,
  Sparkles,
} from 'lucide-react';

const chapters = [
  ['01', 'Topology to homology', 'Understand boundaries, kernels, images, homology, and Betti numbers geometrically and algebraically.'],
  ['02', 'Complexes and persistence', 'Build simplicial or cubical models and follow their features through a filtration.'],
  ['03', 'Zigzag persistence', 'Allow both insertion and deletion in a non-monotone sequence of spaces.'],
  ['04', 'Laplacian families', 'Derive graph, Hodge, sheaf, connection, and persistent Laplacians.'],
];

const b1 = [
  [-1, 0, -1, 0],
  [1, -1, 0, 0],
  [0, 1, 1, -1],
  [0, 0, 0, 1],
];
const b2 = [[1], [1], [-1], [0]];
const l1Down = [
  [2, -1, 1, 0],
  [-1, 2, 1, -1],
  [1, 1, 2, -1],
  [0, -1, -1, 2],
];
const l1Up = [
  [1, 1, -1, 0],
  [1, 1, -1, 0],
  [-1, -1, 1, 0],
  [0, 0, 0, 0],
];
const l1Filled = [
  [3, 0, 0, 0],
  [0, 3, 0, -1],
  [0, 0, 3, -1],
  [0, -1, -1, 2],
];

function Matrix({
  data,
  rowLabels,
  colLabels,
  label,
  compact = false,
}: {
  data: (number | string)[][];
  rowLabels?: string[];
  colLabels?: string[];
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className={`matrix-shell ${compact ? 'matrix-compact' : ''}`}>
      {label && <span className="matrix-label">{label}</span>}
      <div className="matrix-scroll">
        <table className="matrix" aria-label={label ?? 'Matrix'}>
          {colLabels && <thead><tr><th />{colLabels.map((x) => <th key={x}>{x}</th>)}</tr></thead>}
          <tbody>
            {data.map((row, i) => (
              <tr key={rowLabels?.[i] ?? i}>
                {rowLabels && <th>{rowLabels[i]}</th>}
                {row.map((cell, j) => <td key={j}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}



function RunningComplex({ filled }: { filled: boolean }) {
  return (
    <svg className="complex-svg" viewBox="0 0 520 340" role="img" aria-label={filled ? 'A filled oriented triangle with one tail edge' : 'An unfilled oriented triangular cycle with one tail edge'}>
      <defs><marker id="running-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#ed765d" /></marker></defs>
      <text x="25" y="35" className="svg-kicker">RUNNING COMPLEX K</text>
      {filled && <polygon points="105,245 235,75 350,245" className="face" />}
      <path d="M105 245 L235 75 L350 245 Z M350 245 L465 180" className="edge" />
      <path d="M129 219 L217 103" className="boundary-arrow" markerEnd="url(#running-arrow)" />
      <path d="M258 102 L330 219" className="boundary-arrow" markerEnd="url(#running-arrow)" />
      <path d="M324 245 L138 245" className="boundary-arrow" markerEnd="url(#running-arrow)" />
      {[[105, 245, 'v₀'], [235, 75, 'v₁'], [350, 245, 'v₂'], [465, 180, 'v₃']].map(([x, y, t]) => <g key={String(t)}><circle cx={Number(x)} cy={Number(y)} r="10" className="vertex" /><text x={Number(x) + 14} y={Number(y) - 12} className="svg-label">{t}</text></g>)}
      <text x="160" y="145" className="edge-label">e₀₁</text><text x="298" y="145" className="edge-label">e₁₂</text><text x="214" y="270" className="edge-label">e₀₂</text><text x="402" y="238" className="edge-label">e₂₃</text>
      {filled && <text x="221" y="205" className="face-label">t₀₁₂</text>}
    </svg>
  );
}

function SimplexGallery() {
  return (
    <div className="simplex-row">
      <div><span>0-SIMPLEX</span><svg viewBox="0 0 120 90" aria-label="A vertex"><circle cx="60" cy="45" r="10" className="vertex" /></svg><strong>vertex</strong><small>{'{v₀}'}</small></div>
      <div><span>1-SIMPLEX</span><svg viewBox="0 0 120 90" aria-label="An edge with its two endpoints"><line x1="25" y1="45" x2="95" y2="45" className="edge" /><circle cx="25" cy="45" r="8" className="vertex" /><circle cx="95" cy="45" r="8" className="vertex" /></svg><strong>edge</strong><small>{'{v₀,v₁}'}</small></div>
      <div><span>2-SIMPLEX</span><svg viewBox="0 0 120 90" aria-label="A filled triangle"><polygon points="60,10 105,78 15,78" className="face" /><path d="M60 10 L105 78 L15 78 Z" className="edge" /><circle cx="60" cy="10" r="6" className="vertex" /><circle cx="105" cy="78" r="6" className="vertex" /><circle cx="15" cy="78" r="6" className="vertex" /></svg><strong>triangle</strong><small>{'{v₀,v₁,v₂}'}</small></div>
      <div><span>3-SIMPLEX</span><svg viewBox="0 0 120 90" aria-label="A tetrahedron"><path d="M60 8 L106 72 L18 72 Z M60 8 L61 52 M18 72 L61 52 L106 72" className="edge" /><circle cx="60" cy="8" r="5" className="vertex" /><circle cx="106" cy="72" r="5" className="vertex" /><circle cx="18" cy="72" r="5" className="vertex" /><circle cx="61" cy="52" r="5" className="vertex" /></svg><strong>tetrahedron</strong><small>{'{v₀,v₁,v₂,v₃}'}</small></div>
    </div>
  );
}

function ComplexFamilies() {
  return (
    <div className="complex-family-grid">
      <div className="family-card">
        <span>VIETORIS-RIPS</span>
        <svg viewBox="0 0 230 150" aria-label="Four points and the clique complex induced by a distance threshold"><path d="M40 105 L105 28 L190 92 L40 105 M105 28 L110 115 L40 105 M105 28 L190 92 M110 115 L190 92" className="family-muted-edge" /><path d="M40 105 L105 28 L110 115 Z" className="family-highlight" />{[[40, 105], [105, 28], [190, 92], [110, 115]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" className="vertex" />)}</svg>
        <h4>Pairwise proximity</h4><div className="family-formula">σ∈VR<sub>r</sub>(P) ⇔ d(p,q)≤2r for every p,q∈σ</div><p>Build a threshold graph, then fill every clique. Fast to define, but high-dimensional cliques can make it large.</p>
      </div>
      <div className="family-card">
        <span>ČECH</span>
        <svg viewBox="0 0 230 150" aria-label="Three metric balls with a common intersection"><circle cx="72" cy="84" r="50" className="cover-ball" /><circle cx="150" cy="84" r="50" className="cover-ball" /><circle cx="111" cy="48" r="50" className="cover-ball" /><circle cx="72" cy="84" r="6" className="vertex" /><circle cx="150" cy="84" r="6" className="vertex" /><circle cx="111" cy="48" r="6" className="vertex" /></svg>
        <h4>Common intersections</h4><div className="family-formula">σ∈C<sub>r</sub>(P) ⇔ ⋂<sub>p∈σ</sub>B(p,r)≠∅</div><p>The complex is the nerve of metric balls. Under the usual good-cover conditions, it has the homotopy type of their union.</p>
      </div>
      <div className="family-card">
        <span>ALPHA / DELAUNAY</span>
        <svg viewBox="0 0 230 150" aria-label="Delaunay triangles and an empty circumcircle"><circle cx="120" cy="75" r="58" className="circumcircle" /><path d="M62 70 L121 17 L178 86 Z M62 70 L80 130 L178 86 M80 130 L178 86" className="family-muted-edge" /><polygon points="62,70 121,17 178,86" className="family-highlight" />{[[62, 70], [121, 17], [178, 86], [80, 130]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" className="vertex" />)}</svg>
        <h4>Empty circumspheres</h4><div className="family-formula">σ∈Del(P) ⇔ an empty ball has vertices σ on its boundary</div><p>The alpha complex A<sub>α</sub>(P) keeps Delaunay simplices with a suitable empty circumball of radius at most α. It is usually much sparser than Rips.</p>
      </div>
      <div className="family-card">
        <span>CUBICAL</span>
        <svg viewBox="0 0 230 150" aria-label="A thresholded four by four pixel grid represented as a cubical complex">{[0, 1, 2, 3].flatMap(r => [0, 1, 2, 3].map(c => <rect key={`${r}-${c}`} x={44 + c * 36} y={4 + r * 36} width="34" height="34" className={(r + c === 2 || r === 2 && c < 3 || r === 1 && c === 1) ? 'pixel-on' : 'pixel-off'} />))}</svg>
        <h4>Pixels and voxels</h4><div className="family-formula">Q = I₁×···×I<sub>d</sub>, with each I<sub>j</sub> a point or interval</div><p>Squares and cubes are native cells, so images and volumes need no triangulation. A gray-value threshold gives a natural cubical filtration.</p>
      </div>
    </div>
  );
}

function Spectrum({ values, color = 'green' }: { values: number[]; color?: 'green' | 'coral' | 'blue' }) {
  const max = Math.max(...values, 1);
  return <div className={`spectrum spectrum-${color}`} aria-label={`Eigenvalues ${values.join(', ')}`}>{values.map((value, i) => <div className="eigen" key={`${value}-${i}`}><span>λ{i}</span><i style={{ height: `${18 + (value / max) * 70}px` }} /><b>{value}</b></div>)}</div>;
}

export default function Home() {
  const [filled, setFilled] = useState(false);
  const [stage, setStage] = useState(3);
  const [laplacianView, setLaplacianView] = useState<'open' | 'filled'>('open');
  const stageData = [
    { title: 'Add three vertices', betti: 'β₀ = 3, β₁ = 0', meaning: 'Each vertex begins as its own connected component.' },
    { title: 'Add edge e₀₁', betti: 'β₀ = 2, β₁ = 0', meaning: 'Two components merge; the younger H₀ class dies.' },
    { title: 'Add edge e₁₂', betti: 'β₀ = 1, β₁ = 0', meaning: 'All vertices now belong to one component.' },
    { title: 'Add edge e₀₂', betti: 'β₀ = 1, β₁ = 1', meaning: 'The closing edge creates a 1-dimensional cycle.' },
    { title: 'Add face t₀₁₂', betti: 'β₀ = 1, β₁ = 0', meaning: 'The triangle fills the cycle, so the H₁ class dies.' },
  ];

  return (
    <main className="topology-atlas">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Back to the top"><span>SimplicialComplex</span></a>
        <nav aria-label="Chapter navigation">{chapters.map(([number, title]) => <a key={number} href={`#chapter-${number}`}>{number} {title}</a>)}</nav>
        <a className="edition" href="/">← ALL PLAYGROUNDS</a>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">COMPUTATIONAL TOPOLOGY FOR DATA ANALYSIS</p>
          <h1><em>Computational Topology</em></h1>
          <p className="hero-copy">A visual & equation guide connecting geometry, complexes, persistent homology, and topological Laplacians.</p>
          <a className="start-link" href="#chapter-01">Begin with the foundations <ArrowRight size={17} /></a>
        </div>
      </section>

      <section className="chapter-strip" aria-label="Four chapters">{chapters.map(([number, title, description]) => <a className="chapter-card" href={`#chapter-${number}`} key={number}><span>{number}</span><h2>{title}</h2><p>{description}</p></a>)}</section>

      <section className="lesson" id="chapter-01">
        <aside className="chapter-aside"><span className="chapter-no">CHAPTER 01</span><h2>From topology to homology</h2><p>Start with spaces and continuous deformation, then translate holes into kernels and images that a computer can calculate.</p><div className="chapter-index"><a href="#topology">1.1 Spaces and invariants</a><a href="#boundary">1.2 What boundary means</a><a href="#kernel-image">1.3 Kernel and image</a><a href="#running-example">1.4 Worked matrix example</a></div></aside>
        <article className="chapter-body">
          <div className="section-block" id="topology">
            <p className="kicker">1.1 SPACES, MAPS, INVARIANTS</p>
            <h3>Topology records continuity, not precise measurement</h3>
            <p>A topology τ on a set X is a collection of subsets called <strong>open sets</strong>. It contains ∅ and X, is closed under arbitrary unions, and is closed under finite intersections. These rules specify which points count as locally near one another without requiring coordinates, lengths, or angles.</p>
            <div className="display-math">f:X→Y is continuous ⇔ f<sup>−1</sup>(U) is open in X for every open U⊆Y</div>
            <p>The inverse image condition says that an open region in the output cannot be produced by tearing the input into a discontinuous selection. A homeomorphism is a continuous bijection with a continuous inverse; it declares two spaces topologically identical. A homotopy is weaker: it continuously deforms one map into another.</p>
            <div className="relation-rail"><div><strong>HOMEOMORPHIC</strong><span>X ≅ Y</span><small>Same space up to bending and stretching.</small></div><MoveRight /><div><strong>HOMOTOPY EQUIVALENT</strong><span>X ≃ Y</span><small>Each space can continuously collapse to the other.</small></div><MoveRight /><div><strong>SAME HOMOLOGY</strong><span>H<sub>k</sub>(X) ≅ H<sub>k</sub>(Y)</span><small>Their k-dimensional holes agree.</small></div><MoveRight /><div className="rail-result"><strong>SAME BETTI NUMBERS</strong><span>β<sub>k</sub>(X)=β<sub>k</sub>(Y)</span><small>The reverse implications generally fail.</small></div></div>
            <div className="note"><p><strong>Example.</strong> A solid coffee mug and a solid torus are homeomorphic in the idealised model: each has one tunnel. A circle and an annulus are not homeomorphic (their local dimensions differ) but the annulus deformation retracts onto the circle, so they have the same homotopy type and homology.</p></div>
          </div>

          <div className="section-block" id="boundary">
            <p className="kicker">1.2 WHAT THE BOUNDARY OPERATOR ACTUALLY DOES</p>
            <h3>Boundary means “take the oriented codimension-one faces”</h3>
            <p>A <strong>k-chain</strong> is a formal linear combination of oriented k-simplices. For example, 2t₀−t₁ is a 2-chain made from two oriented triangles. The boundary operator ∂<sub>k</sub>:C<sub>k</sub>→C<sub>k−1</sub> lowers dimension by one: it replaces every k-simplex by the signed sum of its (k−1)-dimensional faces, then extends linearly to every chain.</p>
            <div className="display-math">∂<sub>k</sub>[v₀,…,v<sub>k</sub>] = Σ<sup>k</sup><sub>i=0</sub>(−1)<sup>i</sup>[v₀,…,v̂<sub>i</sub>,…,v<sub>k</sub>]</div>
            <div className="boundary-gallery">
              <div className="boundary-object">
                <span>VERTEX</span>
                <svg viewBox="0 0 180 100">
                  <circle cx="90" cy="48" r="9" className="vertex" />
                  <text x="90" y="80" className="svg-label" textAnchor="middle">v₀</text>
                </svg>
                <strong>∂₀[v₀] = 0</strong>
                <p>A point has no lower-dimensional face.</p>
              </div>

              <div className="boundary-object">
                <span>EDGE</span>
                <svg viewBox="0 0 180 100">
                  <defs>
                    <marker id="bnd-edge-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0 0 L6 3 L0 6z" fill="#ed765d" />
                    </marker>
                  </defs>
                  <line x1="35" y1="48" x2="145" y2="48" className="edge" />
                  <path d="M50 48 L130 48" className="boundary-arrow" markerEnd="url(#bnd-edge-arrow)" />
                  <circle cx="35" cy="48" r="7" className="vertex" />
                  <circle cx="145" cy="48" r="7" className="vertex" />
                  <text x="22" y="78" className="edge-label">−v₀</text>
                  <text x="136" y="78" className="edge-label">+v₁</text>
                </svg>
                <strong>∂₁[v₀,v₁] = v₁−v₀</strong>
                <p>The oriented boundary is the terminal endpoint minus the initial endpoint.</p>
              </div>

              <div className="boundary-object">
                <span>TRIANGLE</span>
                <svg viewBox="0 0 180 100">
                  <defs>
                    <marker id="bnd-tri-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0 0 L6 3 L0 6z" fill="#ed765d" />
                    </marker>
                  </defs>
                  {/* Filled face */}
                  <polygon points="90,14 155,80 25,80" className="face" />
                  {/* Black perimeter edges */}
                  <path d="M90 14 L155 80 L25 80 Z" className="edge" />
                  {/* 3 oriented boundary arrows */}
                  <path d="M42 63 L78 26" className="boundary-arrow" markerEnd="url(#bnd-tri-arrow)" />
                  <path d="M102 26 L138 63" className="boundary-arrow" markerEnd="url(#bnd-tri-arrow)" />
                  <path d="M138 80 L42 80" className="boundary-arrow" markerEnd="url(#bnd-tri-arrow)" />
                  {/* Vertices */}
                  <circle cx="25" cy="80" r="5" className="vertex" />
                  <circle cx="90" cy="14" r="5" className="vertex" />
                  <circle cx="155" cy="80" r="5" className="vertex" />
                  <text x="14" y="94" className="edge-label">v₀</text>
                  <text x="90" y="10" className="edge-label" textAnchor="middle">v₁</text>
                  <text x="162" y="94" className="edge-label">v₂</text>
                </svg>
                <strong>∂₂[v₀,v₁,v₂] = e₁₂−e₀₂+e₀₁</strong>
                <p>The filled triangle becomes its oriented perimeter.</p>
              </div>

              <div className="boundary-object">
                <span>TETRAHEDRON</span>
                <svg viewBox="0 0 180 100">
                  <polygon points="90,8 91,58 26,84" className="face" style={{ opacity: 0.55 }} />
                  <polygon points="90,8 157,84 91,58" className="face" style={{ opacity: 0.85 }} />
                  <path d="M90 8 L157 84 L26 84 Z M90 8 L91 58 M26 84 L91 58 L157 84" className="edge" />
                  <circle cx="90" cy="8" r="4" className="vertex" />
                  <circle cx="26" cy="84" r="4" className="vertex" />
                  <circle cx="157" cy="84" r="4" className="vertex" />
                  <circle cx="91" cy="58" r="4" className="vertex" />
                </svg>
                <strong>∂₃[v₀,v₁,v₂,v₃] = t₁₂₃−t₀₂₃+t₀₁₃−t₀₁₂</strong>
                <p>A solid tetrahedron becomes four oriented triangular faces.</p>
              </div>
            </div>
            <div className="plain-definition"><strong>Why the signs?</strong><p>Adjacent faces inherit opposite orientations, so internal faces cancel when simplices are added. This guarantees ∂<sub>k−1</sub>∂<sub>k</sub>=0: once a boundary has been taken, its own boundary is empty.</p></div>
          </div>

          <div className="section-block" id="kernel-image">
            <p className="kicker">1.3 KERNEL, IMAGE, CYCLE, BOUNDARY</p>
            <h3>Kernel asks what disappears; image asks what can be produced</h3>
            <div className="explain-grid">
              <div className="meaning-card"><span>LINEAR ALGEBRA</span><h4>Kernel of T</h4><div className="family-formula">ker T = {`{x | T(x)=0}`}</div><p>The kernel contains every input that the map sends to zero. For ∂<sub>1</sub>, an edge chain lies in the kernel exactly when all endpoint contributions cancel. It is therefore a closed loop or a sum of loops.</p></div>
              <div className="meaning-card"><span>LINEAR ALGEBRA</span><h4>Image of T</h4><div className="family-formula">im T = {`{T(x) | x in the domain}`}</div><p>The image contains every output that the map can actually produce. For ∂<sub>2</sub>, it consists of edge cycles that occur as perimeters of filled 2-chains.</p></div>
              <div className="meaning-card accent"><span>TOPOLOGY</span><h4>Cycles and boundaries</h4><div className="family-formula">Z<sub>k</sub>=ker ∂<sub>k</sub>, &nbsp; B<sub>k</sub>=im ∂<sub>k+1</sub></div><p>Cycles have no boundary. Boundaries are cycles produced by a higher-dimensional filling. Because ∂²=0, every boundary is automatically a cycle: B<sub>k</sub>⊆Z<sub>k</sub>.</p></div>
            </div>
            <div className="formula-chain"><span>…</span><i>→</i><span>C₂</span><b>∂₂</b><i>→</i><span>C₁</span><b>∂₁</b><i>→</i><span>C₀</span><b>∂₀</b><i>→</i><span>0</span></div>
            <div className="flow-grid">
              <div>
                <small>CLOSED k-CHAINS</small>
                <strong>Z<sub>k</sub> = ker ∂<sub>k</sub></strong>
                <p>Nothing remains after taking their boundary.</p>
              </div>
              <MoveRight className="flow-arrow" />
              <div>
                <small>FILLABLE k-CYCLES</small>
                <strong>B<sub>k</sub> = im ∂<sub>k+1</sub></strong>
                <p>They are perimeters of higher-dimensional chains.</p>
              </div>
              <MoveRight className="flow-arrow" />
              <div className="accent-box">
                <small>CYCLES MODULO FILLINGS</small>
                <strong>H<sub>k</sub> = Z<sub>k</sub>/B<sub>k</sub></strong>
                <p>Two cycles represent the same class if their difference is a boundary.</p>
              </div>
            </div>
            <p><strong>What does the quotient mean?</strong> Homology deliberately treats a fillable loop as zero. It also identifies two loops if they differ only by the boundary of a strip between them. What survives is not one particular drawing of a loop, but its equivalence class under continuous deformation through the complex.</p>
            <div className="definition-grid"><div><b>β₀</b><strong>Connected components</strong><span>Independent pieces of the space.</span></div><div><b>β₁</b><strong>Independent tunnels</strong><span>Closed 1-cycles not filled by 2-chains.</span></div><div><b>β₂</b><strong>Enclosed voids</strong><span>Closed 2-cycles not filled by 3-chains.</span></div><div><b>χ</b><strong>Euler characteristic</strong><span>Σ(−1)ᵏfₖ = Σ(−1)ᵏβₖ.</span></div></div>
          </div>

          <div className="section-block" id="running-example">
            <p className="kicker">1.4 COMPLETE MATRIX EXAMPLE</p><h3>The same edge cycle can be a hole or a boundary</h3>
            <p>Orient e₀₁=[v₀,v₁], e₁₂=[v₁,v₂], e₀₂=[v₀,v₂], and e₂₃=[v₂,v₃]. Each column of B₁ records the signed endpoints of one edge. If t₀₁₂ exists, the column B₂ records its oriented perimeter e₀₁+e₁₂−e₀₂.</p>
            <div className="segmented" role="group" aria-label="Toggle the triangular 2-simplex"><button className={!filled ? 'active' : ''} onClick={() => setFilled(false)}>Unfilled cycle</button><button className={filled ? 'active' : ''} onClick={() => setFilled(true)}>Add 2-simplex t₀₁₂</button></div>
            <div className="example-grid"><div className="diagram-card"><RunningComplex filled={filled} /><div className="diagram-caption"><span>Orange arrows orient c=e₀₁+e₁₂−e₀₂.</span><strong>{filled ? 'c is a boundary: [c]=0 in H₁' : 'c is not a boundary: [c]≠0 in H₁'}</strong></div></div><div className="matrix-stack"><Matrix data={b1} rowLabels={['v₀', 'v₁', 'v₂', 'v₃']} colLabels={['e₀₁', 'e₁₂', 'e₀₂', 'e₂₃']} label="B₁ : C₁ → C₀" compact />{filled ? <Matrix data={b2} rowLabels={['e₀₁', 'e₁₂', 'e₀₂', 'e₂₃']} colLabels={['t₀₁₂']} label="B₂ : C₂ → C₁" compact /> : <div className="empty-matrix"><span>There is no 2-simplex column</span><strong>im B₂ = {`{0}`}</strong></div>}</div></div>
            <div className="calculation-line"><span>rank B₁=3</span><span>dim ker B₁=4−3=1</span><span>rank B₂={filled ? 1 : 0}</span><strong>β₁=dim ker B₁−rank B₂={filled ? 0 : 1}</strong></div>
            <p className="checkline">Direct check: B₁B₂=0. Euler check: χ=4−4{filled ? '+1=1=β₀−β₁+β₂' : '=0=β₀−β₁'}.</p>
          </div>
        </article>
      </section>

      <section className="lesson chapter-alt" id="chapter-02">
        <aside className="chapter-aside"><span className="chapter-no">CHAPTER 02</span><h2>Complexes and persistent homology</h2><p>Replace sampled data by a finite combinatorial space, then study which features survive as scale changes.</p><div className="chapter-index"><a href="#simplicial">2.1 Simplicial complexes</a><a href="#complex-families">2.2 Construction families</a><a href="#filtration">2.3 Filtrations and persistence</a><a href="#reduction">2.4 Matrix reduction</a></div></aside>
        <article className="chapter-body">
          <div className="section-block" id="simplicial"><p className="kicker">2.1 SIMPLICES AND CLOSURE UNDER FACES</p><h3>A simplicial complex is a consistent collection of building blocks</h3><p>A k-simplex is determined by k+1 affinely independent vertices. An abstract simplicial complex K is a family of nonempty finite vertex sets with one essential rule:</p><div className="display-math">σ∈K and ∅≠τ⊆σ ⇒ τ∈K</div><p>If a triangle belongs to K, all three edges and all three vertices must also belong to K. Geometrically, two simplices may intersect only in a common face. These requirements prevent missing edges and invalid overlaps, so the collection glues into a well-defined topological space |K|.</p><SimplexGallery /><div className="plain-definition"><strong>Important distinction.</strong><p>The boundary of a 2-simplex is three 1-simplices; the 2-simplex itself is the filled triangle. Drawing only its three edges gives a 1-dimensional cycle, not a 2-simplex.</p></div></div>

          <div className="section-block" id="complex-families"><p className="kicker">2.2 FOUR WAYS TO BUILD A COMPLEX FROM DATA</p><h3>The data type determines the right combinatorial scaffold</h3><p>Point clouds do not arrive with edges or faces. A construction rule decides which samples should be connected at a scale. Images already have square pixels, so a cubical model is often more natural than triangulation.</p><ComplexFamilies /><div className="comparison-table"><div className="comparison-head"><span>Construction</span><span>Best matched to</span><span>Membership test</span><span>Main trade-off</span></div><div><strong>Čech</strong><span>metric point clouds</span><span>common intersection of balls</span><span>faithful union-of-balls topology; intersections are costly</span></div><div><strong>Vietoris-Rips</strong><span>distance matrices</span><span>all pairwise distances pass</span><span>easy clique construction; can grow combinatorially</span></div><div><strong>Alpha / Delaunay</strong><span>low-dimensional Euclidean points</span><span>empty circumball plus scale bound</span><span>sparse and geometric; expensive in high ambient dimension</span></div><div><strong>Cubical</strong><span>images, voxels, grids</span><span>thresholded square or cube cells</span><span>preserves native grid; not designed for arbitrary point clouds</span></div></div></div>

          <div className="section-block" id="filtration"><p className="kicker">2.3 FILTRATION AND PERSISTENT HOMOLOGY</p><h3>Persistent homology follows the same feature through a growing family of spaces</h3><p>A filtration is a nested sequence K₀⊆K₁⊆⋯⊆Kₙ. The containment is essential: once a simplex appears, it remains, and every face must appear no later than its cofaces. An inclusion K<sub>i</sub>↪K<sub>j</sub> maps cycles in the smaller complex to cycles in the larger one and therefore induces a linear map on homology.</p><div className="display-math">H<sub>k</sub><sup>i,j</sup> = im(H<sub>k</sub>(K<sub>i</sub>) → H<sub>k</sub>(K<sub>j</sub>))</div><div className="plain-definition"><strong>Why take an image?</strong><p>H<sub>k</sub>(K<sub>i</sub>) contains features present at time i. Only classes whose mapped representative remains nonzero at time j land in the image. Thus H<sub>k</sub><sup>i,j</sup> is precisely the vector space of k-dimensional features born by i and still alive at j. Its dimension β<sub>k</sub><sup>i,j</sup> is the persistent Betti number.</p></div><div className="explain-grid"><div className="meaning-card"><span>BIRTH</span><h4>A new independent class appears</h4><p>An edge can join the endpoints of a path and create a 1-cycle; algebraically, dim ker ∂₁ increases without a matching increase in im ∂₂.</p></div><div className="meaning-card"><span>DEATH</span><h4>The class becomes zero later</h4><p>A 2-simplex can fill that cycle; its perimeter enters im ∂₂, so the previous class is quotiented out.</p></div><div className="meaning-card accent"><span>PERSISTENCE</span><h4>Lifetime = death − birth</h4><p>Long intervals are stable across many scales. Short intervals may reflect fine structure or noise; persistence alone does not decide which.</p></div></div>
            <div className="filtration-stage"><svg viewBox="0 0 440 300" role="img" aria-label={`Filtration stage ${stage}: ${stageData[stage].title}`}><text x="20" y="28" className="svg-kicker">K{stage} {stageData[stage].title}</text>{stage >= 4 && <polygon points="90,235 220,65 350,235" className="face" />}{stage >= 1 && <line x1="90" y1="235" x2="220" y2="65" className="edge" />}{stage >= 2 && <line x1="220" y1="65" x2="350" y2="235" className="edge" />}{stage >= 3 && <line x1="90" y1="235" x2="350" y2="235" className="edge" />}{[[90, 235, 'v₀'], [220, 65, 'v₁'], [350, 235, 'v₂']].map(([x, y, t]) => <g key={String(t)}><circle cx={Number(x)} cy={Number(y)} r="10" className="vertex" /><text x={Number(x) + 13} y={Number(y) - 12} className="svg-label">{t}</text></g>)}</svg><div className="persistence-panel"><span className="panel-label">CURRENT HOMOLOGY</span><strong>{stageData[stage].betti}</strong><p>{stageData[stage].meaning}</p><div className="barcode"><div><small>H₀</small><div className="bar-track"><i style={{ left: '0%', width: '100%' }} /></div><b>[0,∞)</b></div><div><small>H₀</small><div className="bar-track"><i style={{ left: '0%', width: '25%' }} className={stage >= 1 ? 'bar-dead' : ''} /></div><b>[0,1)</b></div><div><small>H₀</small><div className="bar-track"><i style={{ left: '0%', width: '50%' }} className={stage >= 2 ? 'bar-dead' : ''} /></div><b>[0,2)</b></div><div><small>H₁</small><div className="bar-track"><i style={{ left: '75%', width: '25%' }} className={`bar-coral ${stage >= 4 ? 'bar-dead' : ''}`} /></div><b>[3,4)</b></div></div></div></div>
            <div className="stepper" role="group" aria-label="Choose a filtration stage">{stageData.map((s, i) => <button key={s.title} onClick={() => setStage(i)} className={i === stage ? 'active' : ''}><span>{i}</span><small>{s.title}</small></button>)}</div>
          </div>

          <div className="section-block" id="reduction"><p className="kicker">2.4 COMPUTING PERSISTENCE</p><h3>Column reduction pairs creators with destroyers</h3><p>Order all simplices by filtration time, with every face before its coface, and assemble the boundary matrix D. Over 𝔽₂, orientation signs disappear because −1=+1. Reduce columns left to right until no two nonzero columns have the same lowest nonzero row.</p><div className="reduction-grid"><Matrix data={[[0, 0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0, 0], [0, 0, 0, 0, 1, 1, 0], [0, 0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0, 0]]} rowLabels={['v₀', 'v₁', 'v₂', 'e₀₁', 'e₁₂', 'e₀₂', 't₀₁₂']} colLabels={['v₀', 'v₁', 'v₂', 'e₀₁', 'e₁₂', 'e₀₂', 't₀₁₂']} label="Filtered boundary matrix D over 𝔽₂" compact /><div className="algorithm-card"><span>REDUCE(D)</span><code>R ← D{`\n`}for j = 1,…,n:{`\n`}  while ∃ℓ&lt;j with low(Rℓ)=low(Rj):{`\n`}    Rj ← Rj + Rℓ  (mod 2)</code><p>If reduced column R<sub>j</sub> is nonzero, (low(R<sub>j</sub>),j) pairs a birth simplex with the simplex that kills its class. A zero column creates a class that may be paired later.</p></div></div><div className="pair-chips"><span>v₁ ↔ e₀₁: one H₀ class dies</span><span>v₂ ↔ e₁₂: another H₀ class dies</span><span>e₀₂ ↔ t₀₁₂: H₁ interval [3,4)</span><strong>v₀ remains unpaired: H₀ interval [0,∞)</strong></div></div>
        </article>
      </section>

      <section className="lesson" id="chapter-03">
        <aside className="chapter-aside"><span className="chapter-no">CHAPTER 03</span><h2>Zigzag persistence</h2><p>Ordinary filtrations only grow. Zigzag persistence also models deletions while retaining an interval decomposition.</p><div className="chapter-index"><a href="#zigzag-definition">3.1 Reversed arrows</a><a href="#zigzag-example">3.2 Complete H₀ example</a></div></aside>
        <article className="chapter-body">
          <div className="section-block" id="zigzag-definition"><p className="kicker">3.1 INSERTION AND DELETION</p><h3>A backward inclusion represents deletion in forward time</h3><div className="zigzag-formula"><span>X₀</span><b>↪</b><span>X₁</span><b>↩</b><span>X₂</span><b>↪</b><span>···</span><b>↩</b><span>Xₙ</span></div><p>The arrow always points from a smaller space into a larger one. Therefore X₁←X₂ means X₂⊆X₁: as the index advances from 1 to 2, simplices were deleted. Applying H<sub>k</sub> gives vector spaces linked by maps in the same arrow directions. This is a representation of an A<sub>n</sub>-type quiver.</p><div className="display-math">H<sub>k</sub>(X₀) ↔ H<sub>k</sub>(X₁) ↔·· ↔ H<sub>k</sub>(Xₙ)</div><div className="plain-definition"><strong>Why can it still produce a barcode?</strong><p>Every finite-dimensional zigzag module over a field decomposes into interval modules. For an interval [b,d], I[b,d]<sub>i</sub>=𝕜 when b≤i≤d and 0 otherwise; every map inside the interval is the identity. The barcode lists exactly these indecomposable summands.</p></div></div>
          <div className="section-block" id="zigzag-example"><p className="kicker">3.2 COMPLETE H₀ EXAMPLE</p><h3>Add an edge, then delete it</h3><div className="zigzag-demo"><div className="zig-snapshot"><span>K₀</span><svg viewBox="0 0 180 120"><circle cx="45" cy="65" r="9" className="vertex" /><circle cx="135" cy="65" r="9" className="vertex" /><text x="37" y="96">a</text><text x="129" y="96">b</text></svg><strong>β₀=2</strong><p>two isolated components</p></div><div className="zig-arrow"><b>→</b><small>insert e<sub>ab</sub></small></div><div className="zig-snapshot active"><span>K₁</span><svg viewBox="0 0 180 120"><line x1="45" y1="65" x2="135" y2="65" className="edge" /><circle cx="45" cy="65" r="9" className="vertex" /><circle cx="135" cy="65" r="9" className="vertex" /><text x="37" y="96">a</text><text x="129" y="96">b</text></svg><strong>β₀=1</strong><p>the edge merges them</p></div><div className="zig-arrow"><b>←</b><small>delete e<sub>ab</sub></small></div><div className="zig-snapshot"><span>K₂</span><svg viewBox="0 0 180 120"><circle cx="45" cy="65" r="9" className="vertex" /><circle cx="135" cy="65" r="9" className="vertex" /><text x="37" y="96">a</text><text x="129" y="96">b</text></svg><strong>β₀=2</strong><p>two components again</p></div></div><div className="zig-linear"><span>𝕜²</span><b>[1&nbsp;1] →</b><span>𝕜</span><b>← [1&nbsp;1]</b><span>𝕜²</span></div><p>Each map sends both component generators to the single connected-component generator in K₁, hence the row matrix [1&nbsp;1]. Choose one generator on each side that maps to the middle class; together they form I[0,2]. The remaining kernel generator on each endpoint produces I[0,0] and I[2,2].</p><div className="zig-result"><div><small>INTERVAL DECOMPOSITION</small><strong>I[0,2] ⊕ I[0,0] ⊕ I[2,2]</strong><p>One component class spans all three indices. Each disconnected endpoint contributes one additional single-index class.</p></div><div className="mini-bars"><span><i style={{ left: '0%', width: '100%' }} />[0,2]</span><span><i style={{ left: '0%', width: '12%' }} />[0,0]</span><span><i style={{ left: '88%', width: '12%' }} />[2,2]</span><b>0&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2</b></div></div><div className="when-grid"><div><strong>Sliding windows</strong><p>New samples enter while old samples leave.</p></div><div><strong>Dynamic networks</strong><p>Edges and vertices can fail, recover, or change membership.</p></div><div><strong>Level-set zigzags</strong><p>Adjacent level and interlevel sets encode both merges and splits.</p></div></div></div>
        </article>
      </section>

      <section className="lesson" id="chapter-04">
        <aside className="chapter-aside"><span className="chapter-no">CHAPTER 04</span><h2>Topological Laplacians</h2><p>Homology records the zero modes. Laplacian spectra retain those modes and add geometric information beyond Betti numbers.</p><div className="chapter-index"><a href="#hodge">4.1 Hodge Laplacian</a><a href="#sheaf">4.2 Sheaf and connection</a><a href="#persistent-lap">4.3 Persistent Laplacian</a></div></aside>
        <article className="chapter-body">
          <div className="section-block" id="hodge"><p className="kicker">4.1 COMBINATORIAL HODGE LAPLACIAN</p><h3>The Laplacian measures two ways a k-chain can fail to be harmonic</h3><div className="display-math">L<sub>k</sub> = B<sub>k</sub><sup>T</sup>B<sub>k</sub> + B<sub>k+1</sub>B<sub>k+1</sub><sup>T</sup> = L<sub>k</sub><sup>down</sup> + L<sub>k</sub><sup>up</sup></div><p>For a k-chain x, the quadratic energy has a direct meaning:</p><div className="display-math small">x<sup>T</sup>L<sub>k</sub>x = ‖B<sub>k</sub>x‖² + ‖B<sub>k+1</sub><sup>T</sup>x‖²</div><p>The first term detects a nonzero boundary: flow is not closed at shared (k−1)-faces. The second detects interaction with (k+1)-cofaces: the chain has a component that can be explained by higher-dimensional fillings. A zero-energy chain is both closed and orthogonal to all boundaries; it is the unique harmonic representative of a homology class.</p><div className="hodge-split"><div><ArrowDown /><strong>B<sub>k</sub><sup>T</sup>B<sub>k</sub></strong><p>Lower adjacency: k-simplices meet along a (k−1)-face.</p></div><div><ArrowUp /><strong>B<sub>k+1</sub>B<sub>k+1</sub><sup>T</sup></strong><p>Upper adjacency: k-simplices bound the same (k+1)-simplex.</p></div><div className="hodge-theorem"><span>DISCRETE HODGE THEOREM</span><strong>ker L<sub>k</sub> ≅ H<sub>k</sub>(K)</strong><p>The multiplicity of eigenvalue zero is β<sub>k</sub>.</p></div></div><div className="segmented" role="group" aria-label="Toggle the Hodge Laplacian example"><button className={laplacianView === 'open' ? 'active' : ''} onClick={() => setLaplacianView('open')}>Unfilled complex</button><button className={laplacianView === 'filled' ? 'active' : ''} onClick={() => setLaplacianView('filled')}>Add triangular face</button></div><div className="lap-example"><Matrix data={laplacianView === 'open' ? l1Down : l1Filled} rowLabels={['e₀₁', 'e₁₂', 'e₀₂', 'e₂₃']} colLabels={['e₀₁', 'e₁₂', 'e₀₂', 'e₂₃']} label={laplacianView === 'open' ? 'L₁=B₁ᵀB₁' : 'L₁=B₁ᵀB₁+B₂B₂ᵀ'} compact /><div className="spectrum-card"><span>1-LAPLACIAN SPECTRUM</span><Spectrum values={laplacianView === 'open' ? [0, 1, 3, 4] : [1, 3, 3, 4]} color={laplacianView === 'open' ? 'coral' : 'green'} /><p>{laplacianView === 'open' ? 'One zero mode means β₁=1. Its eigenvector is the circulation around the unfilled triangle.' : 'The face removes the zero mode, so β₁=0. The positive eigenvalues still encode connectivity and stiffness.'}</p></div></div><div className="display-math small">C<sub>k</sub> = im B<sub>k</sub><sup>T</sup> ⊕ ker L<sub>k</sub> ⊕ im B<sub>k+1</sub></div></div>

          <div className="section-block" id="sheaf"><p className="kicker">4.2 SHEAF AND CONNECTION LAPLACIANS</p><h3>Sheaves compare vector-valued data only after transporting it to a common space</h3><p>A cellular sheaf F assigns a vector space F(v) to every vertex, a vector space F(e) to every edge, and a linear restriction map F<sub>v⊲e</sub>:F(v)→F(e) for every incident vertex-edge pair. The direct sum of vertex stalks is C⁰(G;F). For an oriented edge e:u→v, the coboundary measures disagreement after both endpoint values are mapped into the same edge stalk:</p><div className="display-math">(δx)<sub>e</sub> = F<sub>v⊲e</sub>x<sub>v</sub> − F<sub>u⊲e</sub>x<sub>u</sub>, &nbsp;&nbsp; L<sub>F</sub>=δ<sup>T</sup>δ</div><div className="sheaf-example"><div className="transport-diagram"><span className="panel-label">WORKED ONE-EDGE CONNECTION SHEAF</span><svg viewBox="0 0 440 210" role="img" aria-label="Two two-dimensional stalks compared through an edge by a ninety-degree rotation"><defs><marker id="green-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#1d5c45" /></marker><marker id="coral-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#ed765d" /></marker></defs><line x1="90" y1="120" x2="350" y2="120" className="edge" /><text x="198" y="106" className="edge-label">e : u → v</text><circle cx="90" cy="120" r="12" className="vertex" /><circle cx="350" cy="120" r="12" className="vertex" /><text x="69" y="155">F(u)=ℝ²</text><text x="327" y="155">F(v)=ℝ²</text><path d="M90 120 L90 62" className="vector-arrow" markerEnd="url(#green-arrow)" /><path d="M350 120 L292 120" className="vector-arrow coral" markerEnd="url(#coral-arrow)" /><text x="100" y="66" className="edge-label">xᵤ</text><text x="297" y="103" className="edge-label">R₉₀xᵥ</text></svg><p>Set F<sub>u⊲e</sub>=I and F<sub>v⊲e</sub>=R₉₀. Then δ=[−I&nbsp;R₉₀]. The two endpoint vectors agree globally only when x<sub>u</sub>=R₉₀x<sub>v</sub>.</p></div><div className="matrix-stack"><Matrix data={[[-1, 0, 0, -1], [0, -1, 1, 0]]} colLabels={['u₁', 'u₂', 'v₁', 'v₂']} label="δ = [−I  R₉₀]" compact /><Matrix data={[[1, 0, 0, 1], [0, 1, -1, 0], [0, -1, 1, 0], [1, 0, 0, 1]]} label="Lᶠ = δᵀδ" compact /></div></div><div className="formula-pair"><div><small>ENERGY</small><strong>x<sup>T</sup>L<sub>F</sub>x = ‖R₉₀x<sub>v</sub>−x<sub>u</sub>‖²</strong><p>Zero energy means perfect agreement after transport.</p></div><div><small>CONNECTION LAPLACIAN</small><strong>F<sub>v⊲e</sub>∈O(d)</strong><p>Orthogonal restrictions rotate or reflect vectors without changing their lengths; the Laplacian is an nd×nd block matrix.</p></div></div></div>

          <div className="section-block" id="persistent-lap"><p className="kicker">4.3 PERSISTENT LAPLACIAN — FULL WORKED EXAMPLE</p><h3>Build a Laplacian whose kernel is exactly the homology that survives from X to Y</h3><p>Let X be the unfilled triangular cycle with a tail, and let Y=X∪{`{t₀₁₂}`} add the triangular face. We compute the degree-one persistent Laplacian for the pair X⊆Y.</p><div className="persistent-worked"><div><span className="panel-label">EARLY COMPLEX X</span><div className="tiny-complex open"><i /><i /><i /><i /></div><strong>H₁(X)=span([c])</strong><p>c=e₀₁+e₁₂−e₀₂ is closed and not yet fillable.</p></div><ArrowRight /><div><span className="panel-label">LATER COMPLEX Y</span><div className="tiny-complex filled"><i /><i /><i /><i /></div><strong>H₁(Y)=0</strong><p>The new face satisfies ∂₂t₀₁₂=c, so [c] maps to zero.</p></div><ArrowRight /><div className="persistent-result"><span className="panel-label">PERSISTENT GROUP</span><strong>H₁<sup>X,Y</sup>=im(H₁(X)→H₁(Y))=0</strong><p>No one-dimensional class survives across the pair.</p></div></div>
            <div className="plain-definition"><strong>Step 1 — restrict the later chains.</strong><p>C₂<sup>X,Y</sup>={`{d∈C₂(Y) | ∂₂`}<sup>Y</sup>d∈C₁(X){`}`}. Here the only 2-chain is t₀₁₂ and its boundary lies entirely in X, so C₂<sup>X,Y</sup>=span(t₀₁₂) and ∂₂<sup>X,Y</sup> is represented by B₂=[1,1,−1,0]<sup>T</sup>.</p></div>
            <div className="display-math">Δ₁<sup>X,Y</sup> = (B₁<sup>X</sup>)<sup>T</sup>B₁<sup>X</sup> + B₂<sup>X,Y</sup>(B₂<sup>X,Y</sup>)<sup>T</sup></div>
            <div className="persistent-matrix-sum"><Matrix data={l1Down} label="down term (B₁ˣ)ᵀB₁ˣ" compact /><span>+</span><Matrix data={l1Up} label="upper persistent term B₂ˣʸ(B₂ˣʸ)ᵀ" compact /><span>=</span><Matrix data={l1Filled} label="Δ₁ˣʸ" compact /></div>
            <div className="plain-definition"><strong>Step 2 — read the result.</strong><p>The spectrum is {`{1,3,3,4}`}. There are no zero eigenvalues, hence dim ker Δ₁<sup>X,Y</sup>=0=β₁<sup>X,Y</sup>, exactly matching the persistent-homology calculation. In contrast, Δ₁<sup>X,X</sup>=B₁<sup>T</sup>B₁ has spectrum {`{0,1,3,4}`}; its zero mode is the loop before it is filled.</p></div>
            <div className="note"><p><strong>Persistent Hodge theorem.</strong> ker Δ<sub>q</sub><sup>X,Y</sup>≅H<sub>q</sub><sup>X,Y</sup>. The zero-eigenvalue multiplicity recovers the persistent Betti number, while changes in the positive eigenvalues describe geometry that a barcode does not contain.</p></div>
            <div className="comparison-table"><div className="comparison-head"><span>Operator</span><span>Acts on</span><span>What its kernel records</span><span>What the positive spectrum adds</span></div><div><strong>Graph L₀</strong><span>vertex signals</span><span>connected components H₀</span><span>connectivity and spectral gap</span></div><div><strong>Hodge L<sub>k</sub></strong><span>k-simplex signals</span><span>H<sub>k</sub>(K)</span><span>lower and upper adjacency geometry</span></div><div><strong>Sheaf L<sub>F</sub></strong><span>stalk-valued signals</span><span>consistent global sections</span><span>restriction-aware disagreement energy</span></div><div><strong>Persistent Δ<sub>q</sub><sup>X,Y</sup></strong><span>q-chains across X⊆Y</span><span>H<sub>q</sub><sup>X,Y</sup></span><span>spectral change across scales</span></div></div>
          </div>
        </article>
      </section>

      <section className="sources"><div><p className="kicker">SOURCES ONE CONSISTENT NOTATION</p><h2>Reading map</h2><p>The narrative follows Chapters 1–4 of Dey and Wang. The accompanying papers supply computational practice, network examples, simplicial learning, sheaf connections, and persistent Laplacians. Oriented matrices use real coefficients; the persistence-reduction example uses 𝔽₂.</p></div><ol><li><span>BOOK</span><strong>Dey & Wang</strong><p><cite>Computational Topology for Data Analysis</cite>, Chapters 1–4.</p></li><li><span>2017</span><strong>Otter et al.</strong><p><cite>A roadmap for the computation of persistent homology</cite>.</p></li><li><span>2009</span><strong>Horak et al.</strong><p><cite>Persistent Homology of Complex Networks</cite>.</p></li><li><span>2022</span><strong>Goh et al.</strong><p><cite>Simplicial Attention Networks</cite>, Hodge-Laplacian background.</p></li><li><span>2022</span><strong>Barbero et al.</strong><p><cite>Sheaf Neural Networks with Connection Laplacians</cite>.</p></li><li><span>2025</span><strong>Wei & Wei</strong><p><cite>Persistent Topological Laplacians — A Survey</cite>.</p></li></ol></section>
      <footer><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}
