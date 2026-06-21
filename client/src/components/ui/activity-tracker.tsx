"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

type TrackPayload = {
  userId: string | null;
  email: string;
  category: 'Auth' | 'Profile' | 'Booking' | 'Payment' | 'Chat' | 'Scan' | 'Navigation' | 'Interaction';
  action: string;
  details: string;
};

// Retrieve signed-in user info from local storage
function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('museum_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function trackClientEvent(
  category: TrackPayload['category'],
  action: string,
  details: string
) {
  const user = getStoredUser();
  const payload: TrackPayload = {
    userId: user?.id || null,
    email: user?.email || 'guest',
    category,
    action,
    details: details.substring(0, 200)
  };

  fetch('/api/activity/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify(payload)
  }).catch((err) => {
    // Fail silently in production
    console.warn('Telemetry event log failed:', err);
  });
}

export function ActivityTracker() {
  const pathname = usePathname();
  const lastPathname = useRef<string | null>(null);

  // 1. Track navigation (page views)
  useEffect(() => {
    if (pathname && pathname !== lastPathname.current) {
      lastPathname.current = pathname;
      
      // Map pathname to a clean label
      let pageLabel = pathname;
      if (pathname === '/') pageLabel = 'Home Page';
      else if (pathname === '/pricing') pageLabel = 'Pricing Page';
      else if (pathname === '/features') pageLabel = 'Features Page';
      else if (pathname === '/about-us') pageLabel = 'About Us Page';
      else if (pathname === '/contact') pageLabel = 'Contact Page';
      else if (pathname === '/login') pageLabel = 'Login Page';
      else if (pathname === '/signup') pageLabel = 'Signup Page';
      else if (pathname === '/profile') pageLabel = 'User Profile Page';
      else if (pathname === '/personalized') pageLabel = 'Personalized Experience Dashboard';
      else if (pathname === '/admin') pageLabel = 'Admin Dashboard';
      else if (pathname === '/museum-dashboard') pageLabel = 'Museum Supervisor Dashboard';
      else if (pathname === '/controller-dashboard') pageLabel = 'Gate Entry Dashboard';

      const timeoutId = window.setTimeout(() => {
        trackClientEvent('Navigation', 'page_view', `Visited ${pageLabel}`);
      }, 750);

      return () => window.clearTimeout(timeoutId);
    }
  }, [pathname]);

  // 2. Track interactions (clicks on interactive elements)
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      // Find the closest interactive element
      const interactive = target.closest('button, a, [role="button"], .cursor-pointer, select, input[type="submit"]') as HTMLElement;
      if (!interactive) return;

      // Avoid double tracking elements inside the sidebar navigation that already trigger pathname/page_view tracking
      const isSidebarNav = interactive.closest('.admin-sidebar') || interactive.closest('nav');
      
      // Get readable label for the interaction
      let label = '';
      
      // Try button/link text content
      const rawText = (interactive.textContent || '').trim();
      // Replace multiple spaces/newlines with a single space
      const text = rawText.replace(/\s+/g, ' ');
      
      if (text && text.length > 0 && text.length < 50) {
        label = text;
      } else {
        // Fallbacks for icon buttons or images
        label = 
          interactive.getAttribute('aria-label')?.trim() || 
          interactive.getAttribute('title')?.trim() || 
          interactive.getAttribute('name')?.trim() || 
          interactive.id || 
          '';
      }

      if (!label) {
        // Look inside the target child elements (e.g. spans)
        const innerText = Array.from(interactive.querySelectorAll('span, p, h1, h2, h3, h4'))
          .map(el => el.textContent?.trim() || '')
          .filter(t => t.length > 0 && t.length < 40)[0] || '';
        if (innerText) {
          label = innerText;
        }
      }

      if (label && label.length > 0) {
        // Determine action details
        const tag = interactive.tagName.toLowerCase();
        let details = '';
        if (tag === 'a' || interactive.hasAttribute('href')) {
          details = `Clicked link: "${label}"`;
        } else if (tag === 'select') {
          details = `Interacted with dropdown selection: "${label}"`;
        } else {
          details = `Clicked button: "${label}"`;
        }

        // Avoid logging too many noise clicks (like empty headers/footers)
        if (
          label === 'Theme' || 
          label.includes('Toggle theme') || 
          label.includes('System') ||
          label.includes('Dark') ||
          label.includes('Light')
        ) {
          trackClientEvent('Interaction', 'theme_toggle', `Toggled theme/mode selection: "${label}"`);
        } else {
          trackClientEvent('Interaction', 'click', details);
        }
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  return null;
}
