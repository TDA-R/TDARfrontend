import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SimplicialComplex Playground | TDA-R',
  description: 'A visual guide to boundaries, homology, simplicial complexes, persistence, zigzag modules, and topological Laplacians.',
};

export default function SimplicialComplexLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
