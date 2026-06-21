"use client";

import { useEffect, useState } from 'react';
import { BookOpen, Film, Images, Landmark, Loader2, MapPin, Sparkles, Ticket } from 'lucide-react';
import { fetchVirtualGuide, type MuseumVirtualGuide } from '../../lib/virtualGuide';
import Gallery from './Gallery';
import VideoPlayer from './VideoPlayer';

type View = 'overview' | 'videos' | 'gallery' | 'history';
type Props = { museumId: string; initialView?: View; compact?: boolean; onBook?: () => void; onDirections?: () => void };

export default function VirtualGuide({ museumId, initialView = 'overview', compact = false, onBook, onDirections }: Props) {
  const [guide, setGuide] = useState<MuseumVirtualGuide | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [selectedTour, setSelectedTour] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setGuide(null); setError(''); setView(initialView); setSelectedTour(0);
    fetchVirtualGuide(museumId).then((result) => { if (active) setGuide(result); }).catch((loadError) => { if (active) setError((loadError as Error).message); });
    return () => { active = false; };
  }, [initialView, museumId]);

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">{error}</div>;
  if (!guide) return <div className="flex min-h-44 items-center justify-center rounded-xl border bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-2 text-sm text-muted-foreground">Loading virtual guide...</span></div>;

  const tabs: Array<{ id: View; label: string; icon: typeof Film }> = [
    { id: 'overview', label: 'Overview', icon: Sparkles }, { id: 'videos', label: 'Videos', icon: Film }, { id: 'gallery', label: 'Gallery', icon: Images }, { id: 'history', label: 'History', icon: BookOpen }
  ];

  return (
    <section className={`overflow-hidden rounded-2xl border bg-background shadow-sm ${compact ? '' : 'p-1'}`} aria-label={`${guide.museum.name} virtual guide`}>
      <header className="bg-gradient-to-r from-primary/10 via-background to-amber-500/10 p-4">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-primary p-2 text-primary-foreground"><Landmark className="h-5 w-5" /></div><div><h2 className="text-lg font-bold">{guide.museum.name}</h2><p className="text-xs text-muted-foreground">{guide.museum.category} · {guide.museum.location}{guide.museum.state ? `, ${guide.museum.state}` : ''}</p></div></div>
        <div className="mt-4 flex gap-1 overflow-x-auto" role="tablist" aria-label="Virtual guide sections">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${view === id ? 'bg-primary text-primary-foreground' : 'bg-background/80 hover:bg-muted'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
        </div>
      </header>

      <div className="p-4">
        {view === 'overview' ? <div className="space-y-4"><VideoPlayer tour={guide.tours[0]} /><p className="text-sm leading-6 text-muted-foreground">{guide.museum.description || guide.history || 'Explore this museum through its virtual guide.'}</p>{guide.highlights.length ? <div><h3 className="mb-2 text-sm font-semibold">Highlights</h3><div className="flex flex-wrap gap-2">{guide.highlights.map((highlight) => <span key={highlight} className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs">{highlight}</span>)}</div></div> : null}</div> : null}
        {view === 'videos' ? <div className="space-y-3"><VideoPlayer tour={guide.tours[selectedTour]} />{guide.tours.length > 1 ? <div className="grid gap-2 sm:grid-cols-2">{guide.tours.map((tour, index) => <button key={tour.tour_id} type="button" onClick={() => setSelectedTour(index)} className={`rounded-lg border p-3 text-left text-sm ${selectedTour === index ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}><div className="font-medium">{tour.title}</div><div className="mt-1 text-xs text-muted-foreground">{tour.category} · {tour.language.toUpperCase()}</div></button>)}</div> : null}</div> : null}
        {view === 'gallery' ? <Gallery items={guide.gallery} /> : null}
        {view === 'history' ? <article className="prose prose-sm max-w-none dark:prose-invert"><h3>{guide.museum.name} history</h3><p className="whitespace-pre-line leading-7">{guide.history || 'Museum history has not been added yet.'}</p></article> : null}

        {(onBook || onDirections) ? <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">{onBook ? <button type="button" onClick={onBook} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Ticket className="h-4 w-4" />Book Ticket</button> : null}{onDirections ? <button type="button" onClick={onDirections} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"><MapPin className="h-4 w-4" />Directions</button> : null}</div> : null}
      </div>
    </section>
  );
}
