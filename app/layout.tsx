import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./topology.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'https://tda-r.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TDA-R Playgrounds | Interactive Topological Data Analysis",
    template: "%s | TDA-R",
  },
  description:
    "An interactive website for Topological Data Analysis (TDA), connecting theory, algebraic invariants, and interactive data visualisation. Explore MapperAlgo (2D/3D network graph, cluster inspector, R export) and SimplicialComplex (boundary operators, complex families, persistent homology barcodes, zigzag persistence, and discrete Hodge Laplacians).",
  keywords: [
    "TDA",
    "Topological Data Analysis",
    "TDA-R",
    "MapperAlgo",
    "Mapper algorithm",
    "Simplicial Complex",
    "Persistent Homology",
    "Computational Topology",
    "Boundary Operators",
    "Betti Numbers",
    "Vietoris-Rips",
    "Cech complex",
    "Cubical complex",
    "Zigzag persistence",
    "Hodge Laplacian",
    "Topological Laplacians",
    "Sheaf Laplacian",
    "Connection Laplacian",
    "Persistent Laplacian",
    "Harmonic Forms",
    "Data Visualisation",
    "R TDA",
    "Topological Deep Learning",
  ],
  authors: [{ name: "Chi-Chien Wang", url: "https://github.com/TDA-R" }],
  creator: "Chi-Chien Wang",
  publisher: "TDA-R",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "TDA-R Playgrounds | Interactive Topological Data Analysis",
    description:
      "Interactive TDA suites: MapperAlgo 2D/3D network graphs & SimplicialComplex guide for boundary operators, persistent homology, and Hodge Laplacians.",
    url: siteUrl,
    siteName: "TDA-R Playgrounds",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TDA-R Playgrounds | Interactive Topological Data Analysis",
    description:
      "Interactive workspaces for Topological Data Analysis (TDA) featuring MapperAlgo 2D/3D graph visualisation and SimplicialComplex topological Laplacians.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "TDA-R Playgrounds",
    applicationCategory: "EducationalApplication",
    operatingSystem: "All",
    description:
      "An interactive website for Topological Data Analysis (TDA), connecting theory, algebraic invariants, and interactive data visualisation. Featuring MapperAlgo and SimplicialComplex.",
    url: siteUrl,
    author: {
      "@type": "Person",
      name: "Chi-Chien Wang",
      email: "kennywang2003@gmail.com",
      url: "https://github.com/TDA-R",
    },
    hasPart: [
      {
        "@type": "WebApplication",
        name: "MapperAlgo Playground",
        description:
          "Interactive 2D and 3D topological network graph visualisation for the R package MapperAlgo with cluster histograms and JSON export.",
        url: `${siteUrl}/mapper`,
      },
      {
        "@type": "WebApplication",
        name: "SimplicialComplex Playground",
        description:
          "A visual & algebraic guide exploring boundary operators, complex families, persistent homology barcodes, zigzag persistence, and discrete combinatorial Hodge Laplacians.",
        url: `${siteUrl}/simplicial-complex`,
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
