import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SimplicialComplex Guide | Computational Topology & Persistent Homology',
  description:
    'A visual & algebraic guide exploring the foundation of computational topology: boundary operators (∂k / Bk), kernels, images, Betti numbers (βk), complex families (Vietoris-Rips, Čech, Cubical), persistent homology filtration slider, zigzag persistence, and discrete combinatorial Hodge Laplacians.',
  keywords: [
    'Simplicial Complex',
    'Computational Topology',
    'Persistent Homology',
    'Topological Data Analysis',
    'TDA',
    'Boundary Operators',
    'Betti Numbers',
    'Vietoris-Rips Complex',
    'Cech Complex',
    'Cubical Complex',
    'Zigzag Persistence',
    'Hodge Laplacian',
    'Topological Laplacians',
    'Sheaf Laplacian',
    'Connection Laplacian',
    'Persistent Laplacian',
    'Eigenvalue Spectrum',
    'Harmonic Forms',
  ],
  openGraph: {
    title: 'SimplicialComplex Guide | Computational Topology & Persistent Homology',
    description:
      'A visual & algebraic guide exploring boundary operators, complex families, persistent homology barcodes, zigzag persistence, and discrete combinatorial Hodge Laplacians.',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SimplicialComplex Guide | Computational Topology & Persistent Homology',
    description:
      'Explore boundary operators, complex families, filtration barcodes, zigzag persistence, and discrete Hodge Laplacians with real-time eigenvalue spectrum.',
  },
};

export default function SimplicialComplexLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
