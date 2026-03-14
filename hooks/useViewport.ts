import { useEffect, useMemo, useState } from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ViewportInfo {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  isLandscape: boolean;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

const getSafeAreaInset = (side: 'top' | 'bottom' | 'left' | 'right') => {
  if (typeof window === 'undefined') return 0;
  const prop = `env(safe-area-inset-${side})`;
  const value = getComputedStyle(document.documentElement).getPropertyValue(prop);
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function useViewport(): ViewportInfo {
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') {
      return { width: 0, height: 0 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleResize);
      vv.addEventListener('scroll', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleResize);
        vv.removeEventListener('scroll', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return useMemo(() => {
    const { width, height } = size;
    const breakpoint: Breakpoint =
      width < 640 ? 'xs' :
      width < 768 ? 'sm' :
      width < 1024 ? 'md' :
      width < 1280 ? 'lg' : 'xl';

    const isTouchDevice = typeof window !== 'undefined'
      && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

    return {
      width,
      height,
      breakpoint,
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      isTouchDevice,
      isLandscape: width > height,
      safeAreaInsets: {
        top: getSafeAreaInset('top'),
        bottom: getSafeAreaInset('bottom'),
        left: getSafeAreaInset('left'),
        right: getSafeAreaInset('right')
      }
    };
  }, [size]);
}
