"use client";

import { Bike, Bus, Car, Footprints, TrainFront } from 'lucide-react';
import type { TravelMode } from '../../lib/directions';
import { cn } from '../../lib/utils';

type TravelModeSelectorProps = {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
  disabled?: boolean;
};

const modes = [
  { value: 'DRIVING' as const, label: 'Driving', icon: Car },
  { value: 'WALKING' as const, label: 'Walking', icon: Footprints },
  { value: 'BICYCLING' as const, label: 'Cycling', icon: Bike },
  { value: 'TRANSIT' as const, label: 'Transit', icon: Bus },
  { value: 'TRAIN' as const, label: 'Train', icon: TrainFront }
];

export default function TravelModeSelector({ value, onChange, disabled }: TravelModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" role="radiogroup" aria-label="Travel mode">
      {modes.map(({ value: mode, label, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          disabled={disabled}
          onClick={() => onChange(mode)}
          className={cn(
            'inline-flex h-10 items-center justify-center gap-2 rounded-md border px-2 text-xs font-medium transition',
            value === mode ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
            'disabled:cursor-not-allowed disabled:opacity-60'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
