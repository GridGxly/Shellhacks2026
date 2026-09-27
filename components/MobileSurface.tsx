'use client';
import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const query = '(max-width: 1024px), (hover: none) and (pointer: coarse)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export function useTouchLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

/** Phone forms live outside the scaled artwork so the keyboard cannot shrink them. */
export function MobileSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  const touch = useTouchLayout();
  return touch ? createPortal(<div className={`mobile-surface ${className}`}>{children}</div>, document.body) : <>{children}</>;
}
