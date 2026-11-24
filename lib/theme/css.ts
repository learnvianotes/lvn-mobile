import type { Palette } from './tokens'

/**
 * Maps a resolved palette onto the CSS variables Uniwind already compiles (`bg-primary`, `text-foreground`, …).
 * `--color-rose` stays as a name so older class names keep working, but its value is danger — never pink.
 */
export function cssVariables(p: Palette): Record<string, string> {
  return {
    '--color-background': p.paper,
    '--color-foreground': p.ink,
    '--color-card': p.surface,
    '--color-card-foreground': p.ink,
    '--color-popover': p.surface,
    '--color-popover-foreground': p.ink,
    '--color-primary': p.brand,
    '--color-primary-foreground': p.brandForeground,
    '--color-secondary': p.brandSoft,
    '--color-secondary-foreground': p.brand,
    '--color-muted': p.surfaceMuted,
    '--color-muted-foreground': p.inkMuted,
    '--color-accent': p.brandSoft,
    '--color-accent-foreground': p.brand,
    '--color-destructive': p.danger,
    '--color-border': p.line,
    '--color-input': p.line,
    '--color-ring': p.brand,
    '--color-hero': p.inverse,
    '--color-hero-foreground': p.inverseInk,
    '--color-hero-muted': p.inverseMuted,
    '--color-success': p.success,
    '--color-success-soft': p.successSoft,
    '--color-warm': p.warning,
    '--color-warm-soft': p.warningSoft,
    '--color-rose': p.danger,
    '--color-rose-soft': p.dangerSoft,
    '--color-sky': p.info,
    '--color-sky-soft': p.infoSoft,
    '--color-info': p.info,
    '--color-warning': p.warning,
    '--color-highlight': p.highlight,
    '--color-spark': p.spark,
    '--color-spark-soft': p.sparkSoft,
    '--color-spark-ink': p.sparkInk,
  }
}
