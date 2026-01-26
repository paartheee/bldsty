import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
    title: 'BlindLOL 😂 - Hilarious Party Game',
    description: 'Create funny stories with friends by answering questions without seeing previous answers!',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const adsenseId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID;

    return (
        <html lang="en">
            <head>
                {adsenseId && (
                    <Script
                        async
                        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
                        crossOrigin="anonymous"
                        strategy="afterInteractive"
                    />
                )}
            </head>
            <body>
                <div className="gradient-bg" />
                {children}
            </body>
        </html>
    );
}
