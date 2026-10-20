import { useEffect, useRef, useState } from 'react';

// Rotation cannot grant the user activation required by every browser for native
// fullscreen. Keep a viewport-filling fallback so rotation still expands playback.
export default function useLandscapePlayer() {
  const container = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(false);
  const [native, setNative] = useState(false);
  const automatic = useRef(false);
  useEffect(() => {
    const landscape = matchMedia('(orientation: landscape)');
    const mobile = matchMedia('(hover: none) and (pointer: coarse)');
    function rotate() {
      if (landscape.matches && mobile.matches) {
        automatic.current = true;
        setViewport(true);
        if (!document.fullscreenElement) void container.current?.requestFullscreen?.().catch(() => {});
      } else if (automatic.current) {
        automatic.current = false;
        setViewport(false);
        if (document.fullscreenElement === container.current) void document.exitFullscreen().catch(() => {});
      }
    }
    let wasNative = false;
    function changed() {
      const active = document.fullscreenElement === container.current;
      setNative(active);
      if (wasNative && !active) { setViewport(false); automatic.current = false; }
      wasNative = active;
    }
    rotate();
    landscape.addEventListener('change', rotate);
    mobile.addEventListener('change', rotate);
    document.addEventListener('fullscreenchange', changed);
    return () => {
      landscape.removeEventListener('change', rotate);
      mobile.removeEventListener('change', rotate);
      document.removeEventListener('fullscreenchange', changed);
    };
  }, []);
  useEffect(() => {
    if (!viewport) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setViewport(false); };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', escape); };
  }, [viewport]);
  async function toggle() {
    automatic.current = false;
    if (viewport || document.fullscreenElement === container.current) {
      setViewport(false);
      if (document.fullscreenElement === container.current) await document.exitFullscreen();
    } else {
      try {
        if (!container.current?.requestFullscreen) throw new Error('Unsupported fullscreen');
        await container.current.requestFullscreen();
      } catch { setViewport(true); }
    }
  }
  return { container, fullscreen: viewport || native, viewport, toggle };
}
