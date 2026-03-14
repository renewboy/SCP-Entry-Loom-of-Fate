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

/**
 * Reads safe-area-inset-* values via a probe element.
 * `env()` values are not exposed through getComputedStyle on arbitrary
 * properties — we must read them from a property that the browser
 * actually resolves (e.g. padding applied via CSS).
 */
const readSafeAreaInsets = (): ViewportInfo['safeAreaInsets'] => {
  if (typeof document === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 };

  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:fixed',
    'top:0', 'left:0',
    'visibility:hidden', 'pointer-events:none',
    'padding-top:env(safe-area-inset-top)',
    'padding-bottom:env(safe-area-inset-bottom)',
    'padding-left:env(safe-area-inset-left)',
    'padding-right:env(safe-area-inset-right)',
  ].join(';');
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const result = {
    top: parseFloat(cs.paddingTop) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
    right: parseFloat(cs.paddingRight) || 0,
  };
  document.body.removeChild(probe);
  return result;
};

export function useViewport(): ViewportInfo {
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') {
      return { width: 0, height: 0 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  });

  const [safeArea, setSafeArea] = useState<ViewportInfo['safeAreaInsets']>(
    { top: 0, bottom: 0, left: 0, right: 0 }
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Read safe area once on mount and on orientation change
    const updateSafeArea = () => setSafeArea(readSafeAreaInsets());
    updateSafeArea();

    const handleResize = () => {
      const vv = window.visualViewport;
      setSize({
        width: vv ? vv.width : window.innerWidth,
        height: vv ? vv.height : window.innerHeight,
      });
    };

    const handleOrientationChange = () => {
      // Delay to let the browser settle after rotation
      setTimeout(() => {
        handleResize();
        updateSafeArea();
      }, 150);
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
      window.removeEventListener('orientationchange', handleOrientationChange);
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
      safeAreaInsets: safeArea,
    };
  }, [size, safeArea]);
}
