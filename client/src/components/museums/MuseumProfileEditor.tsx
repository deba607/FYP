"use client";

import { useEffect, useState } from 'react';
import { Loader2, LockKeyhole, Save } from 'lucide-react';
import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import MuseumMediaUploader from './MuseumMediaUploader';

type Prices = {
  Adult: number;
  Child: number;
  'Senior Citizen': number;
  Student: number;
  Professor: number;
  'Researcher/Scientist': number;
};

export type EditableMuseum = {
  id: string;
  museum_id: string;
  name: string;
  location: string;
  state?: string;
  category?: string;
  description?: string;
  history?: string;
  highlights?: string[];
  price?: number;
  prices?: Partial<Prices>;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
  loginEmail?: string;
};

const priceKeys: Array<{ key: keyof Prices; label: string; factor: number }> = [
  { key: 'Adult', label: 'Adult', factor: 1 },
  { key: 'Child', label: 'Child', factor: 0.5 },
  { key: 'Senior Citizen', label: 'Senior Citizen', factor: 0.75 },
  { key: 'Student', label: 'Student', factor: 0.6 },
  { key: 'Professor', label: 'Professor', factor: 0.9 },
  { key: 'Researcher/Scientist', label: 'Researcher / Scientist', factor: 0.9 }
];

export default function MuseumProfileEditor({ museum, onUpdated }: { museum: EditableMuseum; onUpdated: (museum: EditableMuseum) => void }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [history, setHistory] = useState('');
  const [highlights, setHighlights] = useState('');
  const [prices, setPrices] = useState<Prices>({ Adult: 200, Child: 100, 'Senior Citizen': 150, Student: 120, Professor: 180, 'Researcher/Scientist': 180 });
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const base = Number(museum.price ?? 200);
    setName(museum.name || '');
    setLocation(museum.location || '');
    setState(museum.state || '');
    setCategory(museum.category || '');
    setDescription(museum.description || '');
    setHistory(museum.history || '');
    setHighlights((museum.highlights || []).join('\n'));
    setPrices(Object.fromEntries(priceKeys.map(({ key, factor }) => [key, Number(museum.prices?.[key] ?? Math.round(base * factor))])) as Prices);
    setImageUrls(museum.imageUrls?.length ? museum.imageUrls : museum.imageUrl ? [museum.imageUrl] : []);
    setVideoUrls(museum.videoUrls?.length ? museum.videoUrls : museum.videoUrl ? [museum.videoUrl] : []);
  }, [museum]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!name.trim() || !location.trim() || !state.trim()) {
      setError('Museum name, location, and state are required.');
      return;
    }

    try {
      setSaving(true);
      const user = getFirebaseClientAuth().currentUser;
      if (!user) throw new Error('Please sign in again before updating the museum.');
      const token = await user.getIdToken();
      const response = await fetch(`/api/museums/${museum.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim(),
          state: state.trim(),
          category: category.trim(),
          description: description.trim(),
          history: history.trim(),
          highlights: highlights.split('\n').map((item) => item.trim()).filter(Boolean),
          prices,
          imageUrl: imageUrls[0] || '',
          imageUrls,
          videoUrl: videoUrls[0] || '',
          videoUrls,
          loginEmail: museum.loginEmail
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.museum) throw new Error(payload?.message || 'Unable to update museum profile.');
      onUpdated(payload.museum as EditableMuseum);
      setSuccess('Museum information and media updated successfully.');
    } catch (saveError) {
      setError((saveError as Error).message || 'Unable to update museum profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6 rounded-xl border bg-background p-5 shadow-xs">
      <div>
        <h2 className="text-xl font-bold">Museum Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">Update public museum information, ticket pricing, photos, and videos.</p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">{success}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">Museum name
          <input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-medium">Category
          <input value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-medium">Location
          <input required value={location} onChange={(event) => setLocation(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 font-normal" />
        </label>
        <label className="space-y-1 text-sm font-medium">State
          <input required value={state} onChange={(event) => setState(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 font-normal" />
        </label>
      </div>

      <label className="block space-y-1 text-sm font-medium">Description
        <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 font-normal" />
      </label>

      <label className="block space-y-1 text-sm font-medium">Museum history
        <textarea rows={6} value={history} onChange={(event) => setHistory(event.target.value)} placeholder="Describe the museum's origin, milestones, and cultural significance." className="w-full rounded-lg border bg-background px-3 py-2 font-normal" />
      </label>

      <label className="block space-y-1 text-sm font-medium">Visitor highlights
        <textarea rows={4} value={highlights} onChange={(event) => setHighlights(event.target.value)} placeholder={'One highlight per line\nFamous artifact collection\nGuided gallery walkthrough'} className="w-full rounded-lg border bg-background px-3 py-2 font-normal" />
        <span className="block text-xs font-normal text-muted-foreground">Enter one highlight per line.</span>
      </label>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="mb-3 text-sm font-semibold">Visitor ticket prices (INR)</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {priceKeys.map(({ key, label }) => (
            <label key={key} className="space-y-1 text-xs font-medium text-muted-foreground">{label}
              <input
                type="number"
                min={0}
                required
                value={prices[key]}
                onChange={(event) => setPrices((current) => ({ ...current, [key]: Number(event.target.value) }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
          ))}
        </div>
      </div>

      <MuseumMediaUploader imageUrls={imageUrls} videoUrls={videoUrls} onChange={({ imageUrls: images, videoUrls: videos }) => { setImageUrls(images); setVideoUrls(videos); }} disabled={saving} />

      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="h-4 w-4" /> Registered login email</div>
        <input value={museum.loginEmail || ''} readOnly aria-readonly="true" className="mt-2 w-full cursor-not-allowed rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground" />
        <p className="mt-1 text-xs text-muted-foreground">This email identifies the museum authority account and cannot be changed.</p>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving changes' : 'Save museum profile'}
        </button>
      </div>
    </form>
  );
}
