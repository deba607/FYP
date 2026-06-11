"use client";

import type { FormEvent } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { login, signupWithGoogle, sendOtp, resetPassword } from '../../lib/api';
import { getFirebaseClientAuth, getGoogleProvider } from '../../lib/config/firebaseClient';

import { Eye, EyeOff, ArrowLeft, Mail, Lock, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'user' | 'admin' | 'museum' | 'controller'>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Forgot Password states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotPwd, setShowForgotPwd] = useState(false);
  const [showForgotConfirmPwd, setShowForgotConfirmPwd] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      setError(role === 'museum' || role === 'controller' ? 'User ID / Email and password are required.' : 'Email and password are required.');
      return;
    }

    try {
      setLoading(true);
      const result = await login(email.trim(), password) as {
        token?: string;
        user?: {
          id: string;
          name: string;
          email: string;
          phone: string;
          role: string;
          profileCompleted: boolean;
        };
      };

      // Verify role matches selected role
      if (result.user && result.user.role !== role) {
        throw new Error(`Access denied. Your account does not have "${role}" privileges.`);
      }

      if (typeof window !== 'undefined') {
        if (result.token) {
          localStorage.setItem('museum_auth_token', result.token);
        }
        if (result.user) {
          localStorage.setItem('museum_auth_user', JSON.stringify(result.user));
        }
      }

      setSuccess('Login successful.');
      
      // Role-based redirection
      if (role === 'admin') {
        router.push('/admin');
      } else if (role === 'museum') {
        router.push('/museum-dashboard');
      } else if (role === 'controller') {
        router.push('/controller-dashboard');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError((err as Error).message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignin = async () => {
    setError('');
    setSuccess('');

    try {
      setGoogleLoading(true);
      const auth = getFirebaseClientAuth();
      const provider = getGoogleProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      const apiResult = await signupWithGoogle(idToken);

      if (typeof window !== 'undefined') {
        localStorage.setItem('museum_auth_user', JSON.stringify(apiResult.user));
      }

      if (apiResult.user.profileCompleted) {
        router.push('/');
        return;
      }

      router.push('/profile');
    } catch (err) {
      setError((err as Error).message || 'Google sign in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email or User ID.');
      return;
    }
    
    try {
      setForgotLoading(true);
      const res = await sendOtp(forgotEmail.trim(), 'forgot_password');
      if (res.success) {
        setForgotSuccess(res.message || 'OTP verification code sent to your email.');
        setForgotStep(2);
      } else {
        setForgotError('Failed to send verification code.');
      }
    } catch (err) {
      setForgotError((err as Error).message || 'Failed to send verification code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotOtp.trim()) {
      setForgotError('Please enter the 6-digit OTP code.');
      return;
    }

    if (!forgotPassword || forgotPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }

    if (forgotPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    try {
      setForgotLoading(true);
      const res = await resetPassword(forgotEmail.trim(), forgotOtp.trim(), forgotPassword);
      if (res.success) {
        setForgotSuccess('Password reset successfully! You can now log in.');
        // Clear forgot states after short delay, then close modal
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotStep(1);
          setForgotEmail('');
          setForgotOtp('');
          setForgotPassword('');
          setForgotConfirmPassword('');
          setForgotSuccess('');
          setForgotError('');
          // Pre-fill the login email input with the recovered user email/ID
          setEmail(forgotEmail);
        }, 3000);
      } else {
        setForgotError('Failed to reset password.');
      }
    } catch (err) {
      setForgotError((err as Error).message || 'Failed to reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <div className="w-full rounded-xl border bg-background p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Sign In</h1>
        <p className="mb-6 text-sm text-muted-foreground">Use your account credentials.</p>

        {/* Role Selector Tabs */}
        <div className="mb-6 grid grid-cols-4 gap-1 rounded-lg bg-slate-100 dark:bg-zinc-800 p-1">
          {(['user', 'admin', 'museum', 'controller'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRole(r);
                setError('');
                setSuccess('');
              }}
              className={`rounded-md py-1.5 text-[11px] sm:text-xs font-semibold capitalize transition-all cursor-pointer ${
                role === r
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {r === 'user' ? 'Visitor' : r}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

        {role === 'user' && (
          <>
            <button
              type="button"
              onClick={onGoogleSignin}
              disabled={googleLoading || loading}
              className="mb-4 w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              {googleLoading ? 'Connecting Google...' : 'Continue with Google'}
            </button>

            <div className="mb-4 text-center text-xs text-muted-foreground">or sign in with email</div>
          </>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              {role === 'museum' || role === 'controller' ? 'User ID or Email' : 'Email'}
            </label>
            <input
              type={role === 'museum' || role === 'controller' ? 'text' : 'email'}
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                role === 'museum' || role === 'controller'
                  ? "Enter User ID or Email"
                  : "name@example.com"
              }
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-md border pl-3 pr-10 py-2 text-sm bg-background"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {/* Forgot Password link */}
            <div className="mt-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setShowForgotModal(true);
                }}
                className="text-xs text-primary hover:underline font-medium cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground font-semibold cursor-pointer hover:opacity-90 transition-opacity"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {role === 'user' && (
          <p className="mt-4 text-sm text-muted-foreground">
            New here?{' '}
            <Link href="/signup" className="text-primary underline font-medium">
              Create an account
            </Link>
          </p>
        )}
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-md rounded-xl border bg-background p-6 shadow-2xl animate-in zoom-in duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="mb-4 flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  if (forgotStep === 2) {
                    setForgotStep(1);
                    setForgotError('');
                    setForgotSuccess('');
                  } else {
                    setShowForgotModal(false);
                  }
                }}
                className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                title="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h2 className="text-xl font-bold tracking-tight">Reset Password</h2>
            </div>
            
            <p className="mb-5 text-xs text-muted-foreground">
              {forgotStep === 1 
                ? "Provide your Email or User ID. We will send you a 6-digit OTP code to verify your identity."
                : `We've sent a 6-digit OTP code to verify. Please enter the code and set your new password below.`
              }
            </p>

            {forgotError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-300">
                {forgotError}
              </div>
            )}
            {forgotSuccess && (
              <div className="mb-4 rounded-md border border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20 p-3 text-xs text-green-700 dark:text-green-300 flex items-start space-x-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotSendOtp} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email or User ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full rounded-md border px-3 py-2 pl-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Enter Email or User ID"
                      required
                    />
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full rounded-md bg-primary py-2 text-sm text-primary-foreground font-semibold cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center space-x-2"
                >
                  {forgotLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <span>Send Verification Code</span>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotResetPassword} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    pattern="\d{6}"
                    className="w-full rounded-md border px-3 py-2 text-center text-lg font-bold tracking-widest bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showForgotPwd ? "text" : "password"}
                      className="w-full rounded-md border pl-9 pr-10 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      value={forgotPassword}
                      onChange={(e) => setForgotPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                    />
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowForgotPwd(!showForgotPwd)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showForgotPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showForgotConfirmPwd ? "text" : "password"}
                      className="w-full rounded-md border pl-9 pr-10 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      required
                    />
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPwd(!showForgotConfirmPwd)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showForgotConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full rounded-md bg-primary py-2 text-sm text-primary-foreground font-semibold cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center space-x-2"
                >
                  {forgotLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Resetting Password...</span>
                    </>
                  ) : (
                    <span>Reset Password</span>
                  )}
                </button>
              </form>
            )}

            {/* Cancel Button */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotStep(1);
                  setForgotError('');
                  setForgotSuccess('');
                }}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                Cancel and close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

