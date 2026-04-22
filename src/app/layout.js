import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./globals.css";
import { Suspense } from "react";
import ClientLayout from '@/components/ClientLayout';

export const metadata = {
  title: 'KE Fleet',
  description: 'KE Fleet Portal',
  icons: {
    icon: '/icons/KE.webp',
    shortcut: '/icons/KE.webp',
    apple: '/icons/KE.webp',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icons/KE.webp" type="image/webp" />
        <link rel="shortcut icon" href="/icons/KE.webp" type="image/webp" />
      </head>
      <body suppressHydrationWarning>
        <Suspense fallback={null}>
          <ClientLayout>{children}</ClientLayout>
        </Suspense>
      </body>
    </html>
  );
}
