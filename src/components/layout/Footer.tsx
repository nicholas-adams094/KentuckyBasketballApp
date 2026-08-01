import { gameCount, profileCount, rosterEntryCount, seasons } from '@/lib/archive';
import { buildHash } from '@/lib/router';
import { useNavigation } from '@/state/navigation';
import { usePreferences } from '@/state/preferences';

export function Footer() {
  const { season, navigate } = useNavigation();
  const { persistenceAvailable } = usePreferences();

  return (
    <footer className="footer">
      <div className="shell footer__inner">
        <div className="footer__disclaimer">
          <p>
            <strong>Big Blue Archive · The complete Tubby Smith era, 1997–2007</strong>
          </p>
          <p style={{ marginTop: 'var(--space-2)' }}>
            An independent, non-commercial editorial fan archive. Not affiliated with, endorsed by, or
            sponsored by the University of Kentucky, the Southeastern Conference or the NCAA. Historical
            data is compiled from official media guides and record books; every derived metric shown in
            this archive is labelled as derived and is not an official statistic.{' '}
            <a
              href={buildHash({ seasonId: season.id, view: 'sources' })}
              onClick={(event) => {
                event.preventDefault();
                navigate(buildHash({ seasonId: season.id, view: 'sources' }));
              }}
            >
              Read the sources and provenance notes
            </a>
            .
          </p>
        </div>

        <div className="footer__meta">
          <span>
            {seasons.length} seasons · {profileCount} players · {rosterEntryCount} roster entries ·{' '}
            {gameCount} games
          </span>
          <span>Fully offline-capable · No tracking · No third-party requests</span>
          {!persistenceAvailable ? (
            <span>Browser storage unavailable — favorites and saved lineups will not persist.</span>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
