import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

import type { Metadata } from 'next';

import { BrandLoadingProvider } from '@/components/brand-loading';
import { ThemeToaster } from '@/components/theme-toggle';
import { themeInitScript } from '@/lib/theme';

export const metadata: Metadata = {
  title: {
    default: 'PetHub — ดูแลด้วยรัก ออกไปด้วยกัน',
    template: '%s | PetHub',
  },
  description:
    'ดูแลสัตว์เลี้ยง บันทึกสุขภาพ กิจวัตรประจำวัน และค้นหาสถานที่ Pet-Friendly ทั่วประเทศไทย',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <BrandLoadingProvider>
          {children}
          <ThemeToaster />
        </BrandLoadingProvider>
      </body>
    </html>
  );
}
