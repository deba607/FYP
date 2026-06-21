"use client";

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, easeInOut } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import { usePathname, useRouter } from 'next/navigation';
import { translate } from '../../lib/i18n';
import { useLanguage } from '../../hooks/use-language';
import { LanguageSelector } from '../ui/language-selector';
import { ModeToggle } from './mode-toggle';
import { trackClientEvent } from '../ui/activity-tracker';
import { getDashboardLinksForRole } from '../../lib/dashboardAccess';
import { subscribeToFirestoreUser } from '../../lib/firestoreUser';
import { getSiteTranslation } from '../../lib/site-translations';

interface SignedInUser {
  id: string;
  name: string;
  email: string;
  photoURL: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  profileCompleted?: boolean;
  role?: string;
}

const navItems = [
  { name: 'Home', href: '/', labelKey: 'nav.home' as const },
  { name: 'Features', href: '/#features', labelKey: 'nav.features' as const },
  { name: 'Contact', href: '/#contact', labelKey: 'nav.contact' as const },
  { name: 'About Us', href: '/#about', labelKey: 'nav.about' as const },
];

const isNavItemActive = (pathname: string, href: string) => {
  if (href === '/') return pathname === '/';
  if (href.startsWith('/#')) return false;
  return pathname.startsWith(href);
};

export default function Header2() {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useLanguage();

  const [isScrolled, setIsScrolled] = useState(false);
  const [signedInUser, setSignedInUser] = useState<SignedInUser | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [dashboardSwitchingTo, setDashboardSwitchingTo] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isDenseLanguage = false;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const loadUser = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const raw = localStorage.getItem('museum_auth_user');
      let storedUser: SignedInUser | null = null;

      if (raw) {
        try {
          storedUser = JSON.parse(raw) as SignedInUser;
        } catch {
          storedUser = null;
        }
      }

      const firebaseUser = getFirebaseClientAuth().currentUser;

      if (!storedUser && !firebaseUser) {
        setSignedInUser(null);
        setRoleChecked(true);
        return;
      }

      setSignedInUser({
        ...(storedUser || {}),
        id: storedUser?.id || firebaseUser?.uid || '',
        name: storedUser?.name || firebaseUser?.displayName || '',
        email: storedUser?.email || firebaseUser?.email || '',
        photoURL: storedUser?.photoURL || firebaseUser?.photoURL || '',
      });
    };

    // reset avatar error whenever the user's photo URL changes
    setAvatarError(false);

    loadUser();
    window.addEventListener('storage', loadUser);
    window.addEventListener('focus', loadUser);
    // listen for in-tab profile updates (dispatched from profile page after upload/remove/save)
    window.addEventListener('user_profile_updated', loadUser as EventListener);
    return () => {
      window.removeEventListener('storage', loadUser);
      window.removeEventListener('focus', loadUser);
      window.removeEventListener('user_profile_updated', loadUser as EventListener);
    };
  }, [pathname]);

  useEffect(() => {
    const auth = getFirebaseClientAuth();
    let unsubscribeFirestoreUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setRoleChecked(false);
      if (unsubscribeFirestoreUser) {
        unsubscribeFirestoreUser();
        unsubscribeFirestoreUser = null;
      }

      if (firebaseUser) {
        unsubscribeFirestoreUser = subscribeToFirestoreUser(
          firebaseUser,
          (data) => {
            const updatedUser: SignedInUser = {
              id: firebaseUser.uid,
              name: data.name || firebaseUser.displayName || '',
              email: data.email || firebaseUser.email || '',
              phone: data.phone || '',
              dateOfBirth: data.dateOfBirth || '',
              address: data.address || '',
              photoURL: data.photoURL || firebaseUser.photoURL || '',
              profileCompleted: !!data.profileCompleted,
              role: data.role || 'user',
            };
            localStorage.setItem('museum_auth_user', JSON.stringify(updatedUser));
            setSignedInUser(updatedUser);
            setRoleChecked(true);
          },
          (err) => {
            console.error("Header Firestore user listener error:", err);
            setRoleChecked(true);
          }
        );
      } else {
        setSignedInUser(null);
        setRoleChecked(true);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestoreUser) {
        unsubscribeFirestoreUser();
      }
    };
  }, []);

  const handleSignOut = async () => {
    // Log user sign-out action before wiping local storage
    if (signedInUser?.email) {
      trackClientEvent('Auth', 'logout', `User signed out: ${signedInUser.email}`);
    } else {
      trackClientEvent('Auth', 'logout', 'Visitor logged out');
    }

    try {
      await signOut(getFirebaseClientAuth());
    } catch {
      // Keep local sign-out behavior even when Firebase session is absent.
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('museum_auth_user');
      localStorage.removeItem('museum_auth_token');
      setSignedInUser(null);
      router.push('/login');
    }
  };

  const userInitial =
    signedInUser?.name?.trim()?.charAt(0)?.toUpperCase() ||
    signedInUser?.email?.trim()?.charAt(0)?.toUpperCase() ||
    'U';
  const visibleNavItems = navItems;
  const dashboardLinks = useMemo(
    () => roleChecked ? getDashboardLinksForRole(signedInUser?.role) : [],
    [roleChecked, signedInUser?.role]
  );
  const isAdmin = dashboardLinks.some((item) => item.href === '/admin');
  const isMuseum = dashboardLinks.some((item) => item.href === '/museum-dashboard');
  const isController = dashboardLinks.some((item) => item.href === '/controller-dashboard');

  const matchedDashboard = pathname.startsWith('/admin')
    ? '/admin'
    : pathname.startsWith('/museum-dashboard')
    ? '/museum-dashboard'
    : pathname.startsWith('/controller-dashboard')
    ? '/controller-dashboard'
    : '';
  const currentDashboard = dashboardLinks.some((item) => item.href === matchedDashboard)
    ? matchedDashboard
    : '';

  useEffect(() => {
    dashboardLinks.forEach((item) => {
      router.prefetch(item.href as any);
    });
  }, [dashboardLinks, router]);

  useEffect(() => {
    setDashboardSwitchingTo('');
  }, [pathname]);

  const containerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 },
  };

  const mobileMenuVariants = {
    closed: {
      opacity: 0,
      x: '100%',
      transition: {
        duration: 0.3,
        ease: easeInOut,
      },
    },
    open: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        ease: easeInOut,
        staggerChildren: 0.1,
      },
    },
  };

  const mobileItemVariants = {
    closed: { opacity: 0, x: 20 },
    open: { opacity: 1, x: 0 },
  };

  return (
    <>
      <motion.header
        data-bmt-no-translate
        className={`fixed top-0 right-0 left-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'border-border/50 bg-background/80 border-b shadow-sm backdrop-blur-md'
            : 'bg-transparent'
        }`}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3 xl:gap-5">
            <motion.div
              className="flex min-w-0 max-w-[220px] shrink-0 items-center gap-2 xl:max-w-[260px]"
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Link
                href="/"
                className="flex min-w-0 items-center gap-3"
              >
                <div className="relative shrink-0">
                  <Image src="/images/logo.png" alt="Bharat Museum" width={40} height={40} className="h-10 w-10 rounded-md object-contain bg-background/80 p-0.5" />
                  <div className="absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full bg-green-400"></div>
                </div>
                <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                  <span data-bmt-no-translate className="text-foreground truncate text-sm font-semibold">
                    Bharat Museum Tickets
                  </span>
                  <span data-bmt-no-translate className={`${isDenseLanguage ? 'hidden' : 'hidden'} text-muted-foreground text-xs 2xl:inline`}>
                    {translate(language, 'brand.tagline')}
                  </span>
                </div>
              </Link>
            </motion.div>

            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 px-1 xl:flex xl:gap-1 2xl:gap-2">
              {visibleNavItems.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                return (
                  <motion.div
                    key={item.name}
                    variants={itemVariants}
                    className="relative shrink-0"
                    onMouseEnter={() => setHoveredItem(item.name)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Link
                      href={item.href as any}
                      aria-current={active ? 'page' : undefined}
                      className={`relative rounded-lg border px-2 py-2 text-[13px] font-medium whitespace-nowrap transition-all duration-300 xl:px-3 xl:text-sm ${
                        active
                          ? 'border-primary/50 bg-primary/10 text-primary shadow-lg shadow-primary/40'
                          : 'border-transparent text-foreground/80 hover:text-foreground'
                      }`}
                    >
                      {active ? (
                        <motion.span
                          className="pointer-events-none absolute inset-0 rounded-lg border border-primary/40"
                          animate={{
                            opacity: [0.35, 0.9, 0.35],
                            boxShadow: [
                              '0 0 4px oklch(0.645 0.246 16.439 / 0.15)',
                              '0 0 18px oklch(0.645 0.246 16.439 / 0.55)',
                              '0 0 4px oklch(0.645 0.246 16.439 / 0.15)'
                            ]
                          }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      ) : null}
                      {hoveredItem === item.name && !active && (
                        <motion.div
                          className="bg-muted absolute inset-0 rounded-lg"
                          layoutId="navbar-hover"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">{translate(language, item.labelKey as any)}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <motion.div
              className="hidden min-w-0 shrink-0 items-center justify-end gap-1.5 xl:flex"
              variants={itemVariants}
            >

              <LanguageSelector compact />

              {dashboardLinks.length > 0 && (
                <div className="relative">
                  <select
                    aria-label="Dashboard Redirect Select"
                    value={dashboardSwitchingTo || currentDashboard}
                    disabled={Boolean(dashboardSwitchingTo)}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDashboardSwitchingTo(e.target.value);
                        router.prefetch(e.target.value as any);
                        router.push(e.target.value as any);
                      }
                    }}
                    className={`bg-background/90 text-foreground hover:bg-muted inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-semibold outline-hidden transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-wait disabled:opacity-70 ${
                      currentDashboard
                        ? 'animate-pulse border-primary/60 bg-primary/10 shadow-lg shadow-primary/40'
                        : 'border-border'
                    }`}
                  >
                    {!currentDashboard && <option value="" disabled className="text-muted-foreground">{getSiteTranslation(language, 'Select Dashboard')}</option>}
                    {dashboardLinks.map((item) => (
                      <option key={item.href} value={item.href} className="text-foreground bg-background">
                        {getSiteTranslation(language, item.label)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {signedInUser ? (
                <div className="group relative">
                  <button className="border-border bg-background/90 hover:bg-muted/60 inline-flex max-w-60 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors 2xl:max-w-72">
                    {signedInUser.photoURL && !avatarError ? (
                      <Image
                        src={signedInUser.photoURL}
                        alt="Profile"
                        width={34}
                        height={34}
                        className="h-7 w-7 rounded-full object-cover"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <span className="bg-foreground text-background inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
                        {userInitial}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm font-semibold">
                        {signedInUser.name || translate(language, 'user.museumVisitor')}
                      </p>
                      <p className="text-muted-foreground hidden truncate text-xs 2xl:block">{signedInUser.email || translate(language, 'user.noEmail')}</p>
                    </div>
                  </button>

                  <div className="border-border bg-background invisible absolute top-14 right-0 z-50 w-72 translate-y-1 rounded-xl border p-4 opacity-0 shadow-lg transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">{translate(language, 'profile.name')}</span> {signedInUser.name || '-'}</p>
                      <p><span className="text-muted-foreground">{translate(language, 'profile.email')}</span> {signedInUser.email || '-'}</p>
                      <p><span className="text-muted-foreground">{translate(language, 'profile.phone')}</span> {signedInUser.phone || '-'}</p>
                      <p><span className="text-muted-foreground">{translate(language, 'profile.dob')}</span> {signedInUser.dateOfBirth || '-'}</p>
                      <p className="wrap-break-word"><span className="text-muted-foreground">{translate(language, 'profile.address')}</span> {signedInUser.address || '-'}</p>
                    </div>
                    <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href="/personalized" className="text-sm font-medium underline">{getSiteTranslation(language, 'For You')}</Link>
                        <Link href="/profile" className="text-sm font-medium underline">{translate(language, 'auth.profile')}</Link>
                        {isAdmin ? (
                          <Link href="/admin" className="text-sm font-medium underline">{translate(language, 'nav.admin')}</Link>
                        ) : null}
                        {isMuseum ? (
                          <Link href="/museum-dashboard" className="text-sm font-medium underline">{getSiteTranslation(language, 'Museum Dashboard')}</Link>
                        ) : null}
                        {isController ? (
                          <Link href="/controller-dashboard" className="text-sm font-medium underline">{getSiteTranslation(language, 'Controller Dashboard')}</Link>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        {translate(language, 'auth.signOut')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href="/login"
                    className="bg-foreground text-background hover:bg-foreground/90 inline-flex items-center space-x-2 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200"
                  >
                    <span>{translate(language, 'auth.signIn')}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              )}
              <ModeToggle />
            </motion.div>
            <motion.button
              className="text-foreground hover:bg-muted rounded-lg p-2 transition-colors duration-200 xl:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              variants={itemVariants}
              whileTap={{ scale: 0.95 }}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </motion.button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm xl:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              className="border-border bg-background fixed top-16 right-4 z-50 w-80 overflow-hidden rounded-2xl border shadow-2xl xl:hidden"
              variants={mobileMenuVariants}
              initial="closed"
              animate="open"
              exit="closed"
            >
              <div className="space-y-6 p-6">
                <div className="space-y-1">
                  {visibleNavItems.map((item) => {
                    const active = isNavItemActive(pathname, item.href);
                    return (
                      <motion.div key={item.name} variants={mobileItemVariants}>
                        <Link
                          href={item.href as any}
                          aria-current={active ? 'page' : undefined}
                          className={`block rounded-lg border px-4 py-3 font-medium transition-all duration-300 ${
                            active
                              ? 'animate-pulse border-primary/60 bg-primary/10 text-primary shadow-lg shadow-primary/40'
                              : 'border-transparent text-foreground hover:bg-muted'
                          }`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {translate(language, item.labelKey as any)}
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>

                <motion.div
                  className="border-border space-y-3 border-t pt-6"
                  variants={mobileItemVariants}
                >
                  {signedInUser ? (
                    <div className="space-y-3">
                      <LanguageSelector />
                      <div className="rounded-lg border p-3 text-sm">
                        <p><span className="text-muted-foreground">{translate(language, 'profile.name')}</span> {signedInUser.name || '-'}</p>
                        <p className="wrap-break-word"><span className="text-muted-foreground">{translate(language, 'profile.email')}</span> {signedInUser.email || '-'}</p>
                        <p><span className="text-muted-foreground">{translate(language, 'profile.phone')}</span> {signedInUser.phone || '-'}</p>
                      </div>
                      <Link
                        href="/personalized"
                        className="bg-primary text-primary-foreground block w-full rounded-lg py-3 text-center font-medium"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {getSiteTranslation(language, 'Personalized for You')}
                      </Link>
                      <Link
                        href="/profile"
                        className="bg-muted text-foreground block w-full rounded-lg py-3 text-center font-medium"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {translate(language, 'auth.viewProfile')}
                      </Link>
                      {isAdmin ? (
                        <Link
                          href="/admin"
                          className="bg-muted text-foreground block w-full rounded-lg py-3 text-center font-medium"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {translate(language, 'nav.admin')}
                        </Link>
                      ) : null}
                      {isMuseum ? (
                        <Link
                          href="/museum-dashboard"
                          className="bg-muted text-foreground block w-full rounded-lg py-3 text-center font-medium"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {getSiteTranslation(language, 'Museum Dashboard')}
                        </Link>
                      ) : null}
                      {isController ? (
                        <Link
                          href="/controller-dashboard"
                          className="bg-muted text-foreground block w-full rounded-lg py-3 text-center font-medium"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {getSiteTranslation(language, 'Controller Dashboard')}
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="block w-full rounded-lg bg-red-600 py-3 text-center font-medium text-white"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          void handleSignOut();
                        }}
                      >
                        {translate(language, 'auth.signOut')}
                      </button>
                    </div>
                  ) : (
                    <>
                    <LanguageSelector />
                    <Link
                      href="/login"
                      className="bg-foreground text-background hover:bg-foreground/90 block w-full rounded-lg py-3 text-center font-medium transition-all duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {translate(language, 'auth.signIn')}
                    </Link>
                    </>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
