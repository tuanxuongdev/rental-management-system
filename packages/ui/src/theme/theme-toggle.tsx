'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import * as React from 'react';

import { Button } from '../components/button';
import { cn } from '../lib/utils';

import { type ThemePreference } from './theme';
import { useTheme } from './theme-provider';

const OPTION_ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

type ThemeToggleLabels = {
  light: string;
  dark: string;
  system: string;
  group: string;
  /** Placeholders: {label}, {resolved} */
  cycleAria: string;
  /** Placeholder: {label} */
  optionAria: string;
};

const DEFAULT_LABELS: ThemeToggleLabels = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  group: 'Color theme',
  cycleAria: 'Theme: {label} (resolved {resolved}). Click to change.',
  optionAria: '{label} theme',
};

function format(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => params[key] ?? match);
}

export type ThemeToggleProps = {
  className?: string;
  /** Compact icon that cycles light → dark → system. */
  variant?: 'cycle' | 'segmented';
  /** Optional i18n labels; falls back to English. */
  labels?: Partial<ThemeToggleLabels>;
};

export function ThemeToggle({
  className,
  variant = 'segmented',
  labels,
}: ThemeToggleProps): React.JSX.Element {
  const { theme, setTheme, cycleTheme, resolvedTheme } = useTheme();
  const resolvedLabels: ThemeToggleLabels = { ...DEFAULT_LABELS, ...labels };
  const options: ThemePreference[] = ['light', 'dark', 'system'];

  if (variant === 'cycle') {
    const Icon = OPTION_ICONS[theme];
    const label = resolvedLabels[theme];
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className}
        aria-label={format(resolvedLabels.cycleAria, { label, resolved: resolvedTheme })}
        title={`${resolvedLabels.group}: ${label}`}
        onClick={cycleTheme}
      >
        <Icon aria-hidden />
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label={resolvedLabels.group}
      className={cn(
        'inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-0.5',
        className,
      )}
    >
      {options.map((value) => {
        const Icon = OPTION_ICONS[value];
        const label = resolvedLabels[value];
        const active = theme === value;
        return (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={active}
            aria-label={format(resolvedLabels.optionAria, { label })}
            title={label}
            className={cn(
              'size-8',
              active &&
                'bg-[var(--accent-soft)] text-[var(--accent-fg)] hover:bg-[var(--accent-soft)]',
            )}
            onClick={() => setTheme(value)}
          >
            <Icon aria-hidden />
          </Button>
        );
      })}
    </div>
  );
}
