import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MapperAlgo Playground | 2D/3D TDA Network Graph',
  description:
    'Interactive 2D and 3D topological network graph visualisation for the TDA Mapper algorithm. Inspect connected clusters, explore feature distributions with histograms, upload custom JSON outputs, and connect with R Mapper pipelines.',
  keywords: [
    'TDA Mapper',
    'Mapper algorithm',
    'Topological Data Analysis',
    'R Mapper',
    'MapperAlgo',
    '3D Force Graph',
    'Cluster Analysis',
    'TDA Visualisation',
  ],
  openGraph: {
    title: 'MapperAlgo Playground | 2D/3D TDA Network Graph',
    description:
      'Interactive 2D and 3D topological network graph visualisation for the TDA Mapper algorithm.',
    type: 'website',
  },
};

export default function MapperLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
