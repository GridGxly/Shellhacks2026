import type { Metadata } from "next";
import { Noto_Music, Pixelify_Sans, Press_Start_2P, Silkscreen } from "next/font/google";
import "./globals.css";

const pressStart = Press_Start_2P({ variable: "--font-press", weight: "400", subsets: ["latin"] });
const pixelify = Pixelify_Sans({ variable: "--font-pixelify", weight: ["400", "500", "600", "700"], subsets: ["latin"] });
const silkscreen = Silkscreen({ variable: "--font-silk", weight: "400", subsets: ["latin"] });
const notoMusic = Noto_Music({ variable: "--font-music", weight: "400", subsets: ["music"] });

export const metadata: Metadata = {
  title: "Slay the Choir",
  description: "A roguelike where every card is music you play into the mic.",
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
