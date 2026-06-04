"use client";

import { Check, ChevronDown, Globe } from 'lucide-react';
import { languages, translate } from '../../lib/i18n';
import { useLanguage } from '../../hooks/use-language';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();
  const currentLanguage = languages.find((item) => item.code === language) ?? languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={translate(language, 'language.label')}
          className="inline-flex max-w-full shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-background/90 px-2.5 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-muted/50"
        >
          <Globe className="h-4 w-4 shrink-0 text-primary" />
          {!compact ? (
            <span className="text-muted-foreground text-xs">{translate(language, 'language.label')}</span>
          ) : null}
          <span className="text-sm font-semibold tracking-wide">{compact ? currentLanguage.shortLabel : currentLanguage.label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-44 border-border bg-popover/95 p-1.5 backdrop-blur-sm"
      >
        {languages.map((item) => {
          const selected = item.code === language;
          return (
            <DropdownMenuItem
              key={item.code}
              onClick={() => setLanguage(item.code)}
              className="cursor-pointer rounded-md px-2 py-2"
            >
              <span className="inline-flex w-8 items-center justify-center rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                {item.shortLabel}
              </span>
              <span className="flex-1 text-sm">{item.label}</span>
              {selected ? <Check className="h-4 w-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
