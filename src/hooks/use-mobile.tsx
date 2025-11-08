import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    // Immediate check on mount
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT || 
           ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0);
  });

  React.useEffect(() => {
    const checkMobile = () => {
      const widthCheck = window.innerWidth < MOBILE_BREAKPOINT;
      const touchCheck = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const isMobileDevice = widthCheck || touchCheck;
      console.log('Mobile detection:', { widthCheck, touchCheck, isMobileDevice });
      setIsMobile(isMobileDevice);
    };
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener("change", checkMobile);
    checkMobile();
    
    return () => mql.removeEventListener("change", checkMobile);
  }, []);

  return isMobile;
}
