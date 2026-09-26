import type { MetadataRoute } from 'next';

// "Add to Home Screen" launches the game full screen in landscape.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Slay the Choir',
    short_name: 'Slay the Choir',
    description: 'A roguelike where every card is music you play into the mic.',
    start_url: '/',
    display: 'fullscreen',
    orientation: 'landscape',
    background_color: '#07070f',
    theme_color: '#07070f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
