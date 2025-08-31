
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { MotionProvider } from '@/components/motion-provider';
import { Inter as FontSans, Cormorant_Garamond as FontSerif } from 'next/font/google'
import { cn } from '@/lib/utils';


const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontSerif = FontSerif({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-headline",
});


export const metadata: Metadata = {
  title: 'Battledore',
  description: 'A web app for managing badminton tournaments.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", fontSans.variable, fontSerif.variable)}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
          <MotionProvider>
            <AuthProvider>
            {children}
            <Toaster />
            </AuthProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
