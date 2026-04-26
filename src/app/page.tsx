'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';

export default function Home() {
  const { data: session } = useSession();

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Next Soccer Management Simulator
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage teams, simulate matches, and track league standings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/leagues"
          className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 bg-primary/10 text-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-card-foreground mb-1">Your Leagues</h2>
          <p className="text-sm text-muted-foreground">Create and manage your soccer leagues</p>
          <div className="absolute bottom-0 left-0 h-0.5 bg-primary w-0 group-hover:w-full transition-all duration-300" />
        </Link>

        {session?.user ? (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-2">Welcome back</h2>
            <p className="text-sm text-muted-foreground mb-4">{session.user.email}</p>
            <Link
              href="/leagues"
              className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-dark"
            >
              Go to Leagues
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-2">Get Started</h2>
            <p className="text-sm text-muted-foreground mb-4">Sign in to create and manage leagues.</p>
            <div className="flex gap-3">
              <Link
                href="/login"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-dark"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-card"
              >
                Register
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
