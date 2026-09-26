import type { Metadata, Viewport } from "next";
import { Noto_Music, Pixelify_Sans, Press_Start_2P, Silkscreen } from "next/font/google";
import "./globals.css";

const pressStart = Press_Start_2P({ variable: "--font-press", weight: "400", subsets: ["latin"] });
const pixelify = Pixelify_Sans({ variable: "--font-pixelify", weight: ["400", "500", "600", "700"], subsets: ["latin"] });
const silkscreen = Silkscreen({ variable: "--font-silk", weight: "400", subsets: ["latin"] });
const notoMusic = Noto_Music({ variable: "--font-music", weight: "400", subsets: ["music"] });

export const metadata: Metadata = {
  title: "Slay the Choir",
  description: "A roguelike where every card is music you play into the mic.",
  // Added to a phone's home screen it opens full screen, with no browser bars.
  appleWebApp: { capable: true, title: "Slay the Choir", statusBarStyle: "black-translucent" },
};

// Phones: no pinch/double-tap zoom on the stage, and draw under the notch in landscape.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#07070f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} ${pixelify.variable} ${silkscreen.variable} ${notoMusic.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
