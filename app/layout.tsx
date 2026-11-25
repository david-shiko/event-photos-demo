import type { Metadata } from 'next';
import './globals.css';
import './event.css';

export const metadata: Metadata = {
  title: 'Свадьба Ани — кадры вечера',
  description: 'Демо: карта вечера, кадры, загрузка, кабинет фотографа. Мок-данные.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
