import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { VIEW_META } from '@/lib/router';
import { seasonLabel } from '@/lib/format';
import { CommandPalette } from '@/components/CommandPalette';
import { OpponentDialog } from '@/components/OpponentDialog';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/layout/Hero';
import { MainNav } from '@/components/layout/MainNav';
import { SeasonRail } from '@/components/layout/SeasonRail';
import { TopBar } from '@/components/layout/TopBar';
import { PlayerDialog } from '@/components/player/PlayerDialog';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { useNavigation } from '@/state/navigation';

// Views are split so the first paint only carries the shell and Season HQ. Each chunk
// is small; the archive still works entirely offline once cached.
const OverviewView = lazy(() => import('@/views/OverviewView').then((m) => ({ default: m.OverviewView })));
const RosterView = lazy(() => import('@/views/RosterView').then((m) => ({ default: m.RosterView })));
const LineupLabView = lazy(() => import('@/views/LineupLabView').then((m) => ({ default: m.LineupLabView })));
const ScheduleView = lazy(() => import('@/views/ScheduleView').then((m) => ({ default: m.ScheduleView })));
const PostseasonView = lazy(() => import('@/views/PostseasonView').then((m) => ({ default: m.PostseasonView })));
const CompareView = lazy(() => import('@/views/CompareView').then((m) => ({ default: m.CompareView })));
const EraVaultView = lazy(() => import('@/views/EraVaultView').then((m) => ({ default: m.EraVaultView })));
const SourcesView = lazy(() => import('@/views/SourcesView').then((m) => ({ default: m.SourcesView })));

function ViewFallback() {
  return (
    <div className="view-loading" aria-hidden="true">
      <div className="skeleton" style={{ height: 34, width: '38%' }} />
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 260 }} />
    </div>
  );
}

export default function App() {
  const { view, season, openPlayerId, openOpponent } = useNavigation();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // Global shortcuts. `/` is ignored while typing so it stays usable in text fields.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Keep the document title in step with the route so history and bookmarks are legible.
  useEffect(() => {
    document.title = `${seasonLabel(season.id)} ${VIEW_META[view].label} · Big Blue Archive`;
  }, [season.id, view]);

  // Announce view changes for screen-reader users, who get no visual transition cue.
  useEffect(() => {
    const region = document.getElementById('route-announcer');
    if (region) region.textContent = `${VIEW_META[view].label}, ${seasonLabel(season.id)} season`;
  }, [view, season.id]);

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <TopBar onOpenSearch={openPalette} />
      <Hero />
      <SeasonRail />
      <MainNav />

      <main className="main shell" id="main-content" tabIndex={-1}>
        <ErrorBoundary label={`${VIEW_META[view].label} could not be displayed`} key={`${view}-${season.id}`}>
          <Suspense fallback={<ViewFallback />}>
            {view === 'overview' && <OverviewView />}
            {view === 'roster' && <RosterView />}
            {view === 'lineup' && <LineupLabView />}
            {view === 'schedule' && <ScheduleView />}
            {view === 'postseason' && <PostseasonView />}
            {view === 'compare' && <CompareView />}
            {view === 'era' && <EraVaultView />}
            {view === 'sources' && <SourcesView />}
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />

      <CommandPalette open={paletteOpen} onClose={closePalette} />
      {openPlayerId ? <PlayerDialog /> : null}
      {openOpponent ? <OpponentDialog /> : null}
      <Toaster />

      <div id="route-announcer" className="visually-hidden" role="status" aria-live="polite" />
    </div>
  );
}
