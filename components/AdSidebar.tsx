'use client';

import { useEffect } from 'react';

interface AdSidebarProps {
    adSlot: string;
    className?: string;
}

export default function AdSidebar({
    adSlot,
    className = '',
}: AdSidebarProps) {
    const adsenseId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID;

    useEffect(() => {
        if (adsenseId && typeof window !== 'undefined') {
            try {
                // @ts-ignore
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (err) {
                console.error('AdSense error:', err);
            }
        }
    }, [adsenseId]);

    // Don't render if no AdSense ID is configured
    if (!adsenseId) {
        return null;
    }

    return (
        <div className={`ad-sidebar-container hidden lg:block ${className}`}>
            <ins
                className="adsbygoogle"
                style={{ display: 'block' }}
                data-ad-client={adsenseId}
                data-ad-slot={adSlot}
                data-ad-format="vertical"
            />
        </div>
    );
}
