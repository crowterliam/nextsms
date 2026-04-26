import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { requireAuth, requireLeagueMember, requireTeamManager } from '@/lib/auth-helpers';
import {
  getActiveTransferListings, createTransferListing, withdrawTransferListing,
  getTransferListing, createTransferOffer, getTransferOffers, getIncomingTransferOffers,
  updateTransferOfferStatus, completeTransfer, getTransferLog, getPlayer,
} from '@/lib/db';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug } = await params;
  const env = getEnv();
  const league = await env.DB.prepare('SELECT id FROM leagues WHERE slug = ?').bind(slug).first<{ id: string }>();
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const { error: memberError } = await requireLeagueMember(request, league.id, user!.id);
  if (memberError) return memberError;

  const url = new URL(request.url);
  const view = url.searchParams.get('view');

  if (view === 'offers_incoming') {
    const teamId = url.searchParams.get('team_id');
    if (!teamId) return NextResponse.json({ error: 'team_id required' }, { status: 400 });
    const offers = await getIncomingTransferOffers(env.DB, parseInt(teamId));
    return NextResponse.json(offers.results);
  }

  if (view === 'offers_sent') {
    const teamId = url.searchParams.get('team_id');
    if (!teamId) return NextResponse.json({ error: 'team_id required' }, { status: 400 });
    const offers = await getTransferOffers(env.DB, parseInt(teamId));
    return NextResponse.json(offers.results);
  }

  if (view === 'log') {
    const log = await getTransferLog(env.DB, league.id);
    return NextResponse.json(log.results);
  }

  const listings = await getActiveTransferListings(env.DB, league.id);
  return NextResponse.json(listings.results);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug } = await params;
  const env = getEnv();
  const league = await env.DB.prepare('SELECT id FROM leagues WHERE slug = ?').bind(slug).first<{ id: string }>();
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const { error: memberError } = await requireLeagueMember(request, league.id, user!.id);
  if (memberError) return memberError;

  const body = await request.json();

  if (body.action === 'list') {
    const { player_id, team_id, asking_price } = body as { player_id: number; team_id: number; asking_price: number };
    if (typeof player_id !== 'number' || player_id <= 0 || typeof team_id !== 'number' || team_id <= 0) return NextResponse.json({ error: 'player_id and team_id required' }, { status: 400 });

    if (typeof asking_price !== 'number' || asking_price < 0 || !Number.isInteger(asking_price)) {
      return NextResponse.json({ error: 'asking_price must be a non-negative integer' }, { status: 400 });
    }

    const { error: managerError } = await requireTeamManager(request, league.id, user!.id, team_id);
    if (managerError) return managerError;

    const player = await getPlayer(env.DB, player_id);
    if (!player || (player as { team_id: number }).team_id !== team_id) {
      return NextResponse.json({ error: 'Player not on this team' }, { status: 400 });
    }

    await createTransferListing(env.DB, player_id, team_id, asking_price || 0, league.id);
    const listings = await getActiveTransferListings(env.DB, league.id);
    return NextResponse.json({ success: true, listings: listings.results });
  }

  if (body.action === 'withdraw') {
    const { listing_id } = body as { listing_id: number };
    if (typeof listing_id !== 'number' || listing_id <= 0) return NextResponse.json({ error: 'listing_id required' }, { status: 400 });
    const listing = await getTransferListing(env.DB, listing_id);
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    const { error: managerError } = await requireTeamManager(request, league.id, user!.id, (listing as { from_team_id: number }).from_team_id);
    if (managerError) return managerError;
    await withdrawTransferListing(env.DB, listing_id);
    const listings = await getActiveTransferListings(env.DB, league.id);
    return NextResponse.json({ success: true, listings: listings.results });
  }

  if (body.action === 'offer') {
    const { listing_id, from_team_id, to_team_id, player_id, amount } = body as {
      listing_id: number; from_team_id: number; to_team_id: number; player_id: number; amount: number;
    };
    if (!listing_id || !from_team_id || !to_team_id || !player_id) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    if (typeof amount !== 'number' || amount < 0 || !Number.isInteger(amount)) {
      return NextResponse.json({ error: 'Amount must be a non-negative integer' }, { status: 400 });
    }

    const { error: offerManagerError } = await requireTeamManager(request, league.id, user!.id, to_team_id);
    if (offerManagerError) return offerManagerError;

    const toTeam = await env.DB.prepare('SELECT budget FROM teams WHERE id = ?').bind(to_team_id).first<{ budget: number }>();
    if (!toTeam || toTeam.budget < amount) {
      return NextResponse.json({ error: 'Insufficient budget' }, { status: 400 });
    }

    await createTransferOffer(env.DB, { listing_id, from_team_id, to_team_id, player_id, amount: amount || 0 });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'accept_offer') {
    const { offer_id } = body as { offer_id: number };
    if (typeof offer_id !== 'number' || offer_id <= 0) return NextResponse.json({ error: 'offer_id required' }, { status: 400 });

    const offer = await env.DB.prepare('SELECT * FROM transfer_offers WHERE id = ?').bind(offer_id).first<{
      id: number; listing_id: number; from_team_id: number; to_team_id: number; player_id: number; amount: number; status: string;
    }>();
    if (!offer || offer.status !== 'pending') {
      return NextResponse.json({ error: 'Invalid offer' }, { status: 400 });
    }

    const listing = await getTransferListing(env.DB, offer.listing_id);
    if (!listing || (listing as { status: string }).status !== 'active') {
      return NextResponse.json({ error: 'Listing no longer active' }, { status: 400 });
    }

    const { error: acceptManagerError } = await requireTeamManager(request, league.id, user!.id, (listing as { from_team_id: number }).from_team_id);
    if (acceptManagerError) return acceptManagerError;

    await updateTransferOfferStatus(env.DB, offer_id, 'accepted');
    await env.DB.prepare("UPDATE transfer_offers SET status = 'rejected', updated_at = datetime('now') WHERE listing_id = ? AND id != ? AND status = 'pending'").bind(offer.listing_id, offer_id).run();
    await completeTransfer(env.DB, offer.listing_id, offer.player_id, offer.to_team_id, offer.amount, league.id);

    const listings = await getActiveTransferListings(env.DB, league.id);
    return NextResponse.json({ success: true, listings: listings.results });
  }

  if (body.action === 'reject_offer') {
    const { offer_id } = body as { offer_id: number };
    if (typeof offer_id !== 'number' || offer_id <= 0) return NextResponse.json({ error: 'offer_id required' }, { status: 400 });
    const offer = await env.DB.prepare('SELECT listing_id FROM transfer_offers WHERE id = ?').bind(offer_id).first<{ listing_id: number }>();
    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    const listing = await getTransferListing(env.DB, offer.listing_id);
    if (listing) {
      const { error: rejectManagerError } = await requireTeamManager(request, league.id, user!.id, (listing as { from_team_id: number }).from_team_id);
      if (rejectManagerError) return rejectManagerError;
    }
    await updateTransferOfferStatus(env.DB, offer_id, 'rejected');
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
