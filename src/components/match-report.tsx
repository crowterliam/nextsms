export interface MatchEventDisplay {
  minute: number;
  type: string;
  team: 'home' | 'away';
  player: string;
  detail?: string;
  secondary_player?: string;
  commentary: string;
}

export interface PlayerStats {
  name: string;
  pos: string;
  goals: number;
  assists: number;
  shots: number;
  shots_on: number;
  tackles: number;
  saves: number;
  keypasses: number;
  yellowcards: number;
  redcards: number;
  rating: number;
}

export interface LineupPlayer {
  position: string;
  name: string;
  is_sub?: boolean;
}

export interface PenaltyRound {
  home_scored: boolean;
  away_scored: boolean;
  home_taker: string;
  away_taker: string;
}

export interface PenaltyResult {
  home_score: number;
  away_score: number;
  rounds: PenaltyRound[];
}

export function EventIcon({ type }: { type: string }) {
  switch (type) {
    case 'GOAL':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
          G
        </span>
      );
    case 'YELLOWCARD': case 'SECONDYELLOWCARD':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-warning/20">
          <span className="w-3 h-4 bg-warning rounded-sm" />
        </span>
      );
    case 'REDCARD':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/20">
          <span className="w-3 h-4 bg-destructive rounded-sm" />
        </span>
      );
    case 'INJURY':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/20 text-destructive text-xs">
          +
        </span>
      );
    case 'SAVE':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-info/20 text-info text-xs font-bold">
          S
        </span>
      );
    case 'CHANGETACTIC':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs">
          T
        </span>
      );
    case 'SUB':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-info/20 text-info text-xs">
          &#x21C4;
        </span>
      );
    case 'PENALTY':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
          P
        </span>
      );
    case 'COMM_HALFTIME': case 'COMM_FULLTIME':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs">
          &#x25CF;
        </span>
      );
    default:
      return null;
  }
}

export function MatchScoreHeader({
  homeName,
  awayName,
  homeScore,
  awayScore,
  homeTactic,
  awayTactic,
  penalties,
  status,
  playedAt,
}: {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homeTactic?: string;
  awayTactic?: string;
  penalties?: PenaltyResult;
  status?: string;
  playedAt?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4 bg-primary/10 text-primary">
          {status === 'played' || !status ? 'Full Time' : status}
        </div>
        <div className="flex items-center justify-center gap-6 sm:gap-12">
          <div className="text-right min-w-[120px]">
            <div className="text-xl sm:text-2xl font-bold">{homeName}</div>
            {homeTactic && (
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                {homeTactic}
              </div>
            )}
          </div>
          <div className="text-4xl sm:text-6xl font-bold tracking-wider">
            <span className="text-primary">{homeScore}</span>
            <span className="text-muted-foreground mx-2">-</span>
            <span className="text-primary">{awayScore}</span>
          </div>
          <div className="text-left min-w-[120px]">
            <div className="text-xl sm:text-2xl font-bold">{awayName}</div>
            {awayTactic && (
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                {awayTactic}
              </div>
            )}
          </div>
        </div>

        {playedAt && (
          <div className="text-center text-sm text-muted-foreground mt-3">
            {new Date(playedAt).toLocaleString()}
          </div>
        )}

        {penalties && (
          <div className="mt-6 pt-4 border-t border-border">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              Penalties: {penalties.home_score} - {penalties.away_score}
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              {penalties.rounds.map((r, i) => (
                <div key={i} className="flex flex-col items-center gap-1 bg-muted/50 rounded-lg px-3 py-2 text-xs min-w-[60px]">
                  <span className={r.home_scored ? 'text-primary font-bold' : 'text-destructive'}>
                    {r.home_taker} {r.home_scored ? '\u2713' : '\u2717'}
                  </span>
                  <span className={r.away_scored ? 'text-primary font-bold' : 'text-destructive'}>
                    {r.away_taker} {r.away_scored ? '\u2713' : '\u2717'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MatchEventsList({ events }: { events: MatchEventDisplay[] }) {
  if (!events?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/50">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Match Commentary</h2>
      </div>
      <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
        {events.map((e, i) => (
          <div
            key={i}
            className={`px-4 py-2.5 text-sm flex items-center gap-3 ${
              e.type === 'GOAL' ? 'bg-primary/5' :
              e.type === 'REDCARD' || e.type === 'SECONDYELLOWCARD' ? 'bg-destructive/5' :
              e.type === 'YELLOWCARD' ? 'bg-warning/5' :
              e.type === 'INJURY' ? 'bg-destructive/5' :
              ''
            }`}
          >
            <span className="text-muted-foreground w-8 text-right shrink-0 text-xs font-mono">{e.minute}&apos;</span>
            <EventIcon type={e.type} />
            <span className={`flex-1 ${e.type === 'GOAL' ? 'font-medium' : ''}`}>{e.commentary}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineupTable({ title, players }: { title: string; players: LineupPlayer[] }) {
  if (!players?.length) return null;

  const starters = players.filter(p => !p.is_sub);
  const subs = players.filter(p => p.is_sub);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/50">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="divide-y divide-border/50">
        {starters.map((p, i) => (
          <div key={`s${i}`} className="px-4 py-2 text-sm flex justify-between items-center hover:bg-muted/20 transition-colors">
            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{p.position}</span>
            <span className="font-medium">{p.name}</span>
          </div>
        ))}
        {subs.length > 0 && (
          <>
            <div className="px-4 py-1.5 text-xs text-muted-foreground bg-muted/30">Substitutes</div>
            {subs.map((p, i) => (
              <div key={`sub${i}`} className="px-4 py-2 text-sm flex justify-between items-center hover:bg-muted/20 transition-colors text-muted-foreground">
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{p.position}</span>
                <span>{p.name}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function StatsTable({ title, players }: { title: string; players: PlayerStats[] }) {
  if (!players?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/50">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Player</th>
              <th className="px-2 py-2 text-center font-medium">G</th>
              <th className="px-2 py-2 text-center font-medium">A</th>
              <th className="px-2 py-2 text-center font-medium">Sh</th>
              <th className="px-2 py-2 text-center font-medium">Tk</th>
              <th className="px-2 py-2 text-center font-medium">Kp</th>
              <th className="px-2 py-2 text-center font-medium">Sv</th>
              <th className="px-2 py-2 text-center font-medium">C</th>
              <th className="px-2 py-2 text-center font-bold">Rt</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr
                key={i}
                className={`border-b border-border/50 transition-colors ${
                  p.goals > 0 ? 'bg-primary/5' :
                  p.redcards > 0 ? 'bg-destructive/5' :
                  p.yellowcards > 0 ? 'bg-warning/5' :
                  ''
                }`}
              >
                <td className="px-3 py-1.5 font-medium">{p.name}</td>
                <td className="px-2 py-1.5 text-center">{p.goals || ''}</td>
                <td className="px-2 py-1.5 text-center">{p.assists || ''}</td>
                <td className="px-2 py-1.5 text-center">{p.shots || ''}</td>
                <td className="px-2 py-1.5 text-center">{p.tackles || ''}</td>
                <td className="px-2 py-1.5 text-center">{p.keypasses || ''}</td>
                <td className="px-2 py-1.5 text-center">{p.saves || ''}</td>
                <td className="px-2 py-1.5 text-center">
                  {p.yellowcards > 0 && (
                    <span className="inline-block w-2 h-3 bg-warning rounded-sm mr-1 align-middle" />
                  )}
                  {p.redcards > 0 && (
                    <span className="inline-block w-2 h-3 bg-destructive rounded-sm align-middle" />
                  )}
                </td>
                <td className="px-2 py-1.5 text-center font-bold">{p.rating || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
