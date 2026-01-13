import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Blind Story - Hilarious Party Game',
    description: 'Create funny stories with friends by answering questions without seeing previous answers!',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <div className="gradient-bg" />
                {children}
            </body>
        </html>
    );
}
