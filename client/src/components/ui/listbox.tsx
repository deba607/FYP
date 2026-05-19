"use client";

import React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./dropdown-menu";
import { cn } from "../../lib/utils";

type Item = { value: string; label: React.ReactNode };

export default function Listbox({
  items,
  value,
  onChange,
  className,
  triggerClassName,
}: {
  items: Item[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
  triggerClassName?: string;
}) {
  const selected = items.find((i) => i.value === value) || items[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full text-left rounded-md border px-3 py-2 text-sm bg-card text-foreground",
            triggerClassName
          )}
        >
          {selected?.label}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className={cn("p-1", className)}>
        {items.map((it) => (
          <DropdownMenuItem
            key={it.value}
            onSelect={() => onChange(it.value)}
            className="text-foreground"
          >
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
