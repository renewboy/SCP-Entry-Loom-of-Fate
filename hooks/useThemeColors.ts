import { useMemo, useEffect } from 'react';

interface ThemeColors {
    accent: string;
    soft: string;
    underline: string;
    glow: string;
}

export function useThemeColors(stability: number): ThemeColors {
    const colors = useMemo<ThemeColors>(() => {
        if (stability > 70) {
            return {
                accent: '#33ff00',
                soft: 'rgba(51,255,0,0.18)',
                underline: 'rgba(51,255,0,0.45)',
                glow: 'rgba(51,255,0,0.35)'
            };
        }
        if (stability > 30) {
            return {
                accent: '#f59e0b',
                soft: 'rgba(245,158,11,0.18)',
                underline: 'rgba(245,158,11,0.45)',
                glow: 'rgba(245,158,11,0.35)'
            };
        }
        return {
            accent: '#ef4444',
            soft: 'rgba(239,68,68,0.18)',
            underline: 'rgba(239,68,68,0.45)',
            glow: 'rgba(239,68,68,0.35)'
        };
    }, [stability]);

    useEffect(() => {
        const root = document.documentElement;
        const prev = {
            accent: root.style.getPropertyValue('--theme-accent'),
            soft: root.style.getPropertyValue('--theme-accent-soft'),
            underline: root.style.getPropertyValue('--theme-accent-underline'),
            glow: root.style.getPropertyValue('--theme-accent-glow')
        };
        root.style.setProperty('--theme-accent', colors.accent);
        root.style.setProperty('--theme-accent-soft', colors.soft);
        root.style.setProperty('--theme-accent-underline', colors.underline);
        root.style.setProperty('--theme-accent-glow', colors.glow);
        return () => {
            root.style.setProperty('--theme-accent', prev.accent || '#33ff00');
            root.style.setProperty('--theme-accent-soft', prev.soft || 'rgba(51,255,0,0.18)');
            root.style.setProperty('--theme-accent-underline', prev.underline || 'rgba(51,255,0,0.45)');
            root.style.setProperty('--theme-accent-glow', prev.glow || 'rgba(51,255,0,0.35)');
        };
    }, [colors]);

    return colors;
}
