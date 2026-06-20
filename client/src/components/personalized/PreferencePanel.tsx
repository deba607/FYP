"use client";

import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import type { PersonalizationPreferences } from '../../lib/recommendations';

type PreferencePanelProps = {
  open: boolean;
  preferences: PersonalizationPreferences;
  categories: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (preferences: PersonalizationPreferences) => void;
};

export default function PreferencePanel({ open, preferences, categories, saving, onClose, onSave }: PreferencePanelProps) {
  const [draft, setDraft] = useState(preferences);

  useEffect(() => setDraft(preferences), [preferences, open]);
  if (!open) return null;

  const toggleCategory = (category: string) => {
    setDraft((current) => ({
      ...current,
      favoriteCategories: current.favoriteCategories.includes(category)
        ? current.favoriteCategories.filter((item) => item !== category)
        : [...current.favoriteCategories, category]
    }));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Personalization preferences">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border bg-background p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Tune your recommendations</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your choices are private and can be changed at any time.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border p-2 hover:bg-muted" aria-label="Close preferences"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label className="text-sm font-semibold">Favorite categories</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${draft.favoriteCategories.includes(category) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Preferred city
              <input value={draft.preferredCity} onChange={(event) => setDraft({ ...draft, preferredCity: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" placeholder="e.g. Kolkata" />
            </label>
            <label className="text-sm font-semibold">Preferred state
              <input value={draft.preferredState} onChange={(event) => setDraft({ ...draft, preferredState: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" placeholder="e.g. West Bengal" />
            </label>
            <label className="text-sm font-semibold">Maximum ticket budget (INR)
              <input type="number" min="0" value={draft.budgetMax ?? ''} onChange={(event) => setDraft({ ...draft, budgetMax: event.target.value === '' ? null : Number(event.target.value) })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" placeholder="No limit" />
            </label>
            <label className="text-sm font-semibold">Preferred travel mode
              <select value={draft.travelMode} onChange={(event) => setDraft({ ...draft, travelMode: event.target.value as PersonalizationPreferences['travelMode'] })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal">
                <option value="DRIVING">Driving</option><option value="WALKING">Walking</option><option value="BICYCLING">Cycling</option><option value="TRANSIT">Public Transit</option><option value="TRAIN">Train</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t pt-4">
          <button type="button" onClick={onClose} className="h-10 rounded-md border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
          <button type="button" disabled={saving} onClick={() => onSave(draft)} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
