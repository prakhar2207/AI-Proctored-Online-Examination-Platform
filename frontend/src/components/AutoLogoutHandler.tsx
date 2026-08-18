'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuthSession, clearAuthSession } from '@/lib/api';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export default function AutoLogoutHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }

    timeoutId.current = setTimeout(() => {
      handleInactivityLogout();
    }, INACTIVITY_TIMEOUT_MS);
  };

  const handleInactivityLogout = () => {
    // Only logout if the user is actually logged in
    const session = getAuthSession();
    
    // Ignore auto-logout if we are already on login or register pages
    if (pathname === '/login' || pathname === '/register') return;

    if (session) {
      console.log('[AutoLogout] User inactive for 30 minutes. Logging out.');
      clearAuthSession();
      alert('Your session has expired due to inactivity. Please sign in again.');
      router.push('/login?session_expired=true');
    }
  };

  useEffect(() => {
    // Setup event listeners for user activity
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Initialize the timer
    resetTimer();

    // Throttle the event listener so we don't clear/set timeouts thousands of times a second
    let throttleTimer = false;
    const activityListener = () => {
      if (!throttleTimer) {
        resetTimer();
        throttleTimer = true;
        setTimeout(() => { throttleTimer = false; }, 1000); // Only reset timer once per second maximum
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, activityListener, { passive: true });
    });

    return () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
      events.forEach((event) => {
        window.removeEventListener(event, activityListener);
      });
    };
  }, [pathname]);

  return null;
}
