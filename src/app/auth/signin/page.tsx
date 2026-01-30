"use client";

import { signIn } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SignInPage() {
  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center bg-[#0f0f12] px-4 py-8 dark:bg-[#0f0f12]">
      {/* Theme toggle: top-right */}
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      {/* Main card: split panel, rounded, soft shadow */}
      <div className="flex w-full max-w-4xl overflow-hidden rounded-[1.5rem] bg-[#1a1a1f] shadow-2xl shadow-black/40 ring-1 ring-white/5">
        {/* Window controls (macOS style) */}
        <div className="absolute left-5 top-5 flex gap-2 z-10">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>

        {/* Left panel: sign-in form */}
        <div className="relative flex flex-1 flex-col justify-center px-12 py-14 pl-14 pt-16 sm:px-16">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Use your company account to continue
          </p>
          <div className="mt-10">
            <button
              type="button"
              onClick={() => signIn("azure-ad", { callbackUrl: "/dashboard" })}
              className="flex w-full items-center justify-center gap-3 rounded-[1.25rem] py-3.5 text-base font-medium text-white transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-[#1a1a1f]"
              style={{
                background: "linear-gradient(90deg, #3f3f46 0%, #52525b 50%, #71717a 100%)",
                boxShadow: "0 1px 0 0 rgba(255,255,255,0.08) inset, 0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 21 21" fill="none" aria-hidden>
                <path
                  d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm4.5 14.5h-3v-4h3v4zm0-5h-3V7h3v2.5zm-4 5h-3v-4h3v4zm0-5h-3V7h3v2.5zm-4 5H5v-4h2.5v4zm0-5H5V7h2.5v2.5z"
                  fill="currentColor"
                />
              </svg>
              Sign in with Microsoft
            </button>
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">
            Single sign-on with Azure AD. Contact IT if you need access.
          </p>
        </div>

        {/* Right panel: celestial decorative */}
        <div className="relative hidden w-[48%] overflow-hidden rounded-r-[1.5rem] bg-[#0d0d10] sm:block">
          {/* Stars */}
          <div className="absolute inset-0 opacity-80">
            {[...Array(40)].map((_, i) => (
              <span
                key={i}
                className="absolute h-px w-px rounded-full bg-white"
                style={{
                  left: `${(i * 13 + 7) % 100}%`,
                  top: `${(i * 17 + 11) % 100}%`,
                  opacity: 0.3 + (i % 4) * 0.15,
                  width: i % 3 === 0 ? "2px" : "1px",
                  height: i % 3 === 0 ? "2px" : "1px",
                }}
              />
            ))}
          </div>
          {/* Light streaks */}
          <div
            className="absolute left-1/2 top-1/2 h-32 w-px -translate-x-1/2 -translate-y-1/2 opacity-30"
            style={{
              background: "linear-gradient(180deg, transparent 0%, rgba(147, 197, 253, 0.6) 20%, rgba(147, 197, 253, 0.3) 50%, transparent 100%)",
            }}
          />
          <div
            className="absolute right-[28%] top-[22%] h-24 w-px opacity-25"
            style={{
              background: "linear-gradient(180deg, transparent 0%, rgba(147, 197, 253, 0.5) 30%, transparent 100%)",
            }}
          />
          {/* Large orb (planet) with glow */}
          <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-sky-200/90 to-sky-400/70 shadow-lg" style={{ boxShadow: "0 0 60px 20px rgba(147, 197, 253, 0.25), 0 0 100px 40px rgba(147, 197, 253, 0.1)" }} />
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-100/80" />
          {/* Smaller orb */}
          <div className="absolute right-[22%] top-[18%] h-14 w-14 rounded-full bg-sky-200/70" style={{ boxShadow: "0 0 30px 10px rgba(147, 197, 253, 0.2)" }} />
          {/* Brand at bottom */}
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <span className="text-sm font-medium tracking-wide text-white/90">
              Procurement
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
