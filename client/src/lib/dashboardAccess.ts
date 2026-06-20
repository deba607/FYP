export type DashboardRole = 'admin' | 'museum' | 'controller' | 'user';

export type DashboardLink = {
  href: '/admin' | '/museum-dashboard' | '/controller-dashboard';
  label: string;
};

export function normalizeDashboardRole(role?: string | null): DashboardRole {
  const normalized = String(role || 'user').trim().toLowerCase();

  if (normalized === 'admin' || normalized === 'museum' || normalized === 'controller') {
    return normalized;
  }

  return 'user';
}

export function getDashboardLinksForRole(role?: string | null): DashboardLink[] {
  switch (normalizeDashboardRole(role)) {
    case 'admin':
      return [
        { href: '/admin', label: 'Admin Dashboard' },
      ];
    case 'museum':
      return [
        { href: '/museum-dashboard', label: 'Museum Dashboard' },
        { href: '/controller-dashboard', label: 'Controller Dashboard' },
      ];
    case 'controller':
      return [
        { href: '/controller-dashboard', label: 'Controller Dashboard' },
      ];
    default:
      return [];
  }
}
