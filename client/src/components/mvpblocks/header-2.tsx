"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, easeInOut } from 'framer-motion';
import { Menu, X, ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from 'firebase/auth';
import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import { usePathname } from 'next/navigation';

import { ModeToggle } from './mode-toggle'

interface NavItem {
  name: string;
  href: string;
}

type SignedInUser = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  photoURL?: string;
  profileCompleted?: boolean;
};

const navItems: NavItem[] = [
  { name: 'Home', href: '/' },
  { name: 'Features', href: '/features' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Contact', href: '/contact' },
  { name: 'About Us', href: '/about-us' },
  
];

export default function Header2() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [signedInUser, setSignedInUser] = useState<SignedInUser | null>(null);
  const [avatarError, setAvatarError] = useState(false);


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
        return;
      }

      setSignedInUser({
        ...(storedUser || {}),
        id: storedUser?.id || firebaseUser?.uid,
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

  const handleSignOut = async () => {
    try {
      await signOut(getFirebaseClientAuth());
    } catch {
      // Keep local sign-out behavior even when Firebase session is absent.
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('museum_auth_user');
      localStorage.removeItem('museum_auth_token');
      setSignedInUser(null);
      window.location.href = '/login';
    }
  };

  const userInitial =
    signedInUser?.name?.trim()?.charAt(0)?.toUpperCase() ||
    signedInUser?.email?.trim()?.charAt(0)?.toUpperCase() ||
    'U';

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
        className={`fixed top-0 right-0 left-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'border-border/50 bg-background/80 border-b shadow-sm backdrop-blur-md'
            : 'bg-transparent'
        }`}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <motion.div
              className="flex items-center space-x-3"
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Link
                href="/"
                className="flex items-center space-x-3"
              >
                <div className="relative">
                  <Image src="/images/logo.png" alt="Bharat Museum" width={40} height={40} className="h-10 w-10 rounded-lg object-contain bg-background/90 p-1 shadow-lg" />
                  <div className="absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full bg-green-400"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-foreground text-lg font-bold">
                    Bharat Museum Tickets
                  </span>
                  <span className="text-muted-foreground -mt-1 text-xs">
                    Ticketing Made Easy
                  </span>
                </div>
              </Link>
            </motion.div>

            <nav className="hidden items-center space-x-1 lg:flex">
              {navItems.map((item) => (
                <motion.div
                  key={item.name}
                  variants={itemVariants}
                  className="relative"
                  onMouseEnter={() => setHoveredItem(item.name)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <Link
                    href={item.href as any}
                    className="text-foreground/80 hover:text-foreground relative rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200"
                  >
                    {hoveredItem === item.name && (
                      <motion.div
                        className="bg-muted absolute inset-0 rounded-lg"
                        layoutId="navbar-hover"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                    <span className="relative z-10">{item.name}</span>
                  </Link>
                </motion.div>
              ))}
            </nav>

            <motion.div
              className="hidden items-center space-x-3 lg:flex"
              variants={itemVariants}
            >
              <motion.button
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 transition-colors duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Search className="h-5 w-5" />
              </motion.button>

              {/* <Link
                to="/login"
                className="text-foreground/80 hover:text-foreground px-4 py-2 text-sm font-medium transition-colors duration-200"
              >
                Sign Indfgdg
              </Link> */}

              {signedInUser ? (
                <div className="group relative">
                  <button className="border-border bg-background/90 hover:bg-muted/60 inline-flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors">
                    {signedInUser.photoURL && !avatarError ? (
                      <Image
                        src={signedInUser.photoURL}
                        alt="Profile"
                        width={34}
                        height={34}
                        className="h-8 w-8 rounded-full object-cover"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <span className="bg-foreground text-background inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
                        {userInitial}
                      </span>
                    )}
                    <div className="max-w-45">
                      <p className="text-foreground truncate text-sm font-semibold">
                        {signedInUser.name || 'Museum Visitor'}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{signedInUser.email || 'No email'}</p>
                    </div>
                  </button>

                  <div className="border-border bg-background invisible absolute top-14 right-0 z-50 w-80 translate-y-1 rounded-xl border p-4 opacity-0 shadow-xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {signedInUser.name || '-'}</p>
                      <p><span className="text-muted-foreground">Email:</span> {signedInUser.email || '-'}</p>
                      <p><span className="text-muted-foreground">Phone:</span> {signedInUser.phone || '-'}</p>
                      <p><span className="text-muted-foreground">DOB:</span> {signedInUser.dateOfBirth || '-'}</p>
                      <p className="wrap-break-word"><span className="text-muted-foreground">Address:</span> {signedInUser.address || '-'}</p>
                    </div>
                    <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
                      <Link href="/profile" className="text-sm font-medium underline">Profile</Link>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Sign Out
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
                    className="bg-foreground text-background hover:bg-foreground/90 inline-flex items-center space-x-2 rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm transition-all duration-200"
                  >
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              )}
            </motion.div>
            <ModeToggle />    
            <motion.button
              className="text-foreground hover:bg-muted rounded-lg p-2 transition-colors duration-200 lg:hidden"
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
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              className="border-border bg-background fixed top-16 right-4 z-50 w-80 overflow-hidden rounded-2xl border shadow-2xl lg:hidden"
              variants={mobileMenuVariants}
              initial="closed"
              animate="open"
              exit="closed"
            >
              <div className="space-y-6 p-6">
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <motion.div key={item.name} variants={mobileItemVariants}>
                      <Link
                        href={item.href as any}
                        className="text-foreground hover:bg-muted block rounded-lg px-4 py-3 font-medium transition-colors duration-200"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.name}
                      </Link>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  className="border-border space-y-3 border-t pt-6"
                  variants={mobileItemVariants}
                >
                  {/* <Link
                    to="/login"
                    className="text-foreground hover:bg-muted block w-full rounded-lg py-3 text-center font-medium transition-colors duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link> */}
                  {signedInUser ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border p-3 text-sm">
                        <p><span className="text-muted-foreground">Name:</span> {signedInUser.name || '-'}</p>
                        <p className="wrap-break-word"><span className="text-muted-foreground">Email:</span> {signedInUser.email || '-'}</p>
                        <p><span className="text-muted-foreground">Phone:</span> {signedInUser.phone || '-'}</p>
                      </div>
                      <Link
                        href="/profile"
                        className="bg-muted text-foreground block w-full rounded-lg py-3 text-center font-medium"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        View Profile
                      </Link>
                      <button
                        type="button"
                        className="block w-full rounded-lg bg-red-600 py-3 text-center font-medium text-white"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          void handleSignOut();
                        }}
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      className="bg-foreground text-background hover:bg-foreground/90 block w-full rounded-lg py-3 text-center font-medium transition-all duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign In
                    </Link>
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
