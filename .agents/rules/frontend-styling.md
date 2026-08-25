# Frontend Styling & Color Tokens Rule

## Core Requirement
All Desktop renderer components must use centralized design tokens and semantic CSS variables defined in `app/desktop/src/renderer/styles.css`. The former browser editor was removed and is not a styling target.

## Rules

1. **No Ad-Hoc / Hardcoded Colors in Code**:
   - Do NOT use arbitrary inline hex color classes in component files (e.g. `bg-[#0d1420]`, `border-[#142637]`, `text-[#f8fafc]`).
   - Do NOT hardcode inline hex values in `style={{ backgroundColor: '#...' }}` unless dynamically computed at runtime (e.g. user color picker).

2. **If a Token is Missing, Create it in the Desktop renderer token layer**:
   - If a new surface, border, accent, or status color is needed for a design, add the semantic CSS variable in `:root` in `app/desktop/src/renderer/styles.css`.
   - Use the token through the existing Desktop renderer styling conventions.
   - Use the semantic class (e.g. `bg-surface-card`, `bg-surface-panel`, `border-border-dark`, `text-text-muted`) in component code.

3. **Available Global Tokens**:
   - **Backgrounds & Surfaces**:
     - `bg-background` (`--background`)
     - `bg-surface` (`--surface`)
     - `bg-surface-2` (`--surface-2`)
     - `bg-surface-3` (`--surface-3`)
     - `bg-surface-dark` (`--surface-dark`)
     - `bg-surface-card` (`--surface-card`)
     - `bg-surface-panel` (`--surface-panel`)
     - `bg-surface-elevated` (`--surface-elevated`)
     - `bg-surface-input` (`--surface-input`)
   - **Borders**:
     - `border-border` (`--border`)
     - `border-border-subtle` (`--border-subtle`)
     - `border-border-dark` (`--border-dark`)
     - `border-border-darker` (`--border-darker`)
     - `border-border-glow` (`--border-glow`)
   - **Brand / Primary**:
     - `bg-primary`, `text-primary` (`--primary`)
     - `bg-primary-hover` (`--primary-hover`)
     - `bg-primary-light` (`--primary-light`)
     - `bg-primary-muted` (`--primary-muted`)
   - **Status**:
     - `text-success`, `bg-success-bg` (`--success`, `--success-bg`)
     - `text-warning`, `bg-warning-bg` (`--warning`, `--warning-bg`)
     - `text-danger`, `bg-danger-bg` (`--danger`, `--danger-bg`)
   - **Typography**:
     - `text-text-primary` / `text-foreground` (`--text-primary`, `--foreground`)
     - `text-text-secondary` (`--text-secondary`)
     - `text-text-muted` (`--text-muted`)
     - `text-text-dim` (`--text-dim`)
