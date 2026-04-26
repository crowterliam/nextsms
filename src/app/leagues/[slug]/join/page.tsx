'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';

export default function JoinLeaguePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const token = searchParams.get('token');
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<{
    league_name: string;
    league_slug: string;
    role: string;
    expires_at: string | null;
  } | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invite token provided');
      setLoading(false);
      return;
    }
    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const res = await fetch(`/api/invitations?token=${encodeURIComponent(token!)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setInvitation(data);
        }
      } else {
        setError('Failed to load invitation');
      }
    } catch {
      setError('Failed to load invitation');
    }
    setLoading(false);
  };

  const handleAccept = async () => {
    setJoining(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: token, action: 'accept' }),
      });
      if (res.ok) {
        router.push(`/leagues/${slug}`);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to join');
      }
    } catch {
      setError('Failed to join');
    }
    setJoining(false);
  };

  const handleReject = async () => {
    await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation_id: token, action: 'reject' }),
    });
    router.push('/leagues');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Join League</h1>
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <>
            <p className="text-muted-foreground mb-4">Sign in to accept this invitation.</p>
            <div className="flex gap-3 justify-center">
              <Link href={`/login?redirect=/leagues/${slug}/join?token=${token}`}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
                Sign In
              </Link>
              <Link href={`/register?redirect=/leagues/${slug}/join?token=${token}`}
                className="px-4 py-2 border border-border rounded-lg">
                Register
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Join League</h1>
        <p className="text-destructive mb-4">{error}</p>
        <Link href="/leagues" className="text-primary hover:underline">Back to Leagues</Link>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Join League</h1>
        <p className="text-muted-foreground mb-4">Invitation not found.</p>
        <Link href="/leagues" className="text-primary hover:underline">Back to Leagues</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="border border-border rounded-lg bg-card p-6 text-center">
        <h1 className="text-2xl font-bold mb-1">{invitation.league_name}</h1>
        <p className="text-sm text-muted-foreground mb-4">
          You have been invited to join as <span className="capitalize font-medium text-foreground">{invitation.role}</span>
        </p>
        {invitation.expires_at && (
          <p className="text-xs text-muted-foreground mb-4">
            Expires: {new Date(invitation.expires_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={handleAccept} disabled={joining}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">
            {joining ? 'Joining...' : 'Accept Invitation'}
          </button>
          <button onClick={handleReject}
            className="px-5 py-2.5 border border-border rounded-lg">
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
