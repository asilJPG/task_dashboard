import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const inter = Inter({ subsets: ['latin', 'cyrillic'], weight: ['300', '400', '500', '600', '700'] });

export const metadata = {
  title: 'TaskBoard — Управление задачами',
  description: 'Канбан-доска для управления задачами и проектами',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
