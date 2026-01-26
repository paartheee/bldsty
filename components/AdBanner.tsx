'use client';

import { useEffect } from 'react';

interface AdBannerProps {
    adSlot: string;
    adFormat?: 'auto' | 'fluid' | 'rectangle';
    fullWidthResponsive?: boolean;
    className?: string;
}

export default function AdBanner({
    adSlot,
    adFormat = 'auto',
    fullWidthResponsive = true,
    className = '',
}: AdBannerProps) {
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
        <div className={`ad-banner-container ${className}`}>
            <ins
                className="adsbygoogle"
                style={{ display: 'block' }}
                data-ad-client={adsenseId}
                data-ad-slot={adSlot}
                data-ad-format={adFormat}
                data-full-width-responsive={fullWidthResponsive.toString()}
            />
        </div>
    );
}
