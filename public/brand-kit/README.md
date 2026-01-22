# fluxo.sh Brand Kit

Terminal-inspired personal finance tracking with neobrutalist aesthetics.

## Logo

### Mark
The FX$H mark combines:
- **FX** - Fluxo (flow)
- **$** - Financial focus
- **H** - Shell (.sh domain)

### Variations

#### SVG (Scalable)
- `logos/logo.svg` - Light theme (40×40)
- `logos/logo-dark.svg` - Dark theme (40×40)
- `logos/logo-large.svg` - Large version (128×128)

#### PNG Exports
Available in `exports/` directory:
- `favicon-16-{light|dark}.png` - 16×16px
- `favicon-32-{light|dark}.png` - 32×32px
- `icon-48-{light|dark}.png` - 48×48px
- `icon-96-{light|dark}.png` - 96×96px
- `icon-192-{light|dark}.png` - 192×192px (PWA icon)
- `icon-512-{light|dark}.png` - 512×512px (PWA icon)

### Usage Rules
- Minimum size: 16×16px
- Always maintain square aspect ratio
- Border must be 5% of size (2px at 40px)
- Never rotate or distort
- Keep clear space of 25% around mark

## Colors

### Primary Palette
```css
--background: #ffffff     /* Pure white */
--foreground: #000000     /* Pure black */
--border: #000000         /* 100% opacity */
```

### Semantic Colors
```css
--muted: #f5f5f5         /* Light gray backgrounds */
--muted-foreground: #737373  /* Secondary text */
--accent: #f5f5f5        /* Hover states */
--destructive: #ef4444   /* Error/delete actions */
```

### Terminal Theme
The neobrutalist aesthetic uses:
- High contrast (no gradients)
- Solid borders (2-4px)
- No shadows or blur effects
- Monospace font everywhere

## Typography

### Primary Font
**JetBrains Mono** - Monospace typeface for terminal aesthetic

```css
font-family: 'JetBrains Mono', 'Courier New', monospace;
```

### Font Weights
- **Regular (400)** - Body text, labels
- **Medium (500)** - Emphasized content
- **Bold (700)** - Headings, logo

### Type Scale
```css
--font-size-xs: 0.75rem    /* 12px */
--font-size-sm: 0.875rem   /* 14px */
--font-size-base: 1rem     /* 16px */
--font-size-lg: 1.125rem   /* 18px */
--font-size-xl: 1.25rem    /* 20px */
--font-size-2xl: 1.5rem    /* 24px */
--font-size-3xl: 1.875rem  /* 30px */
```

## Design Principles

### Neobrutalism
- **Raw aesthetics** - Visible borders, no polish
- **Functional clarity** - Everything serves a purpose
- **Bold contrast** - Black/white, no subtle grays
- **Flat design** - No depth illusions, everything 2D

### Terminal UX
- **Keyboard-first** - All actions have shortcuts
- **Dense information** - Efficient use of space
- **Monospace alignment** - Grid-based layouts
- **Command patterns** - Familiar CLI metaphors

### Privacy-First
- **Local-first** - Data stays on device when possible
- **Transparent sync** - Clear about what goes where
- **Export-friendly** - Users own their data
- **No dark patterns** - Honest, direct interface

## Component Patterns

### Buttons
```tsx
// Primary action
<button className="border-2 border-foreground bg-foreground text-background px-4 py-2 font-bold hover:bg-background hover:text-foreground transition-colors">
  Confirm
</button>

// Secondary action
<button className="border-2 border-foreground bg-background text-foreground px-4 py-2 font-medium hover:bg-muted transition-colors">
  Cancel
</button>
```

### Cards
```tsx
<div className="border-2 border-foreground bg-background p-4">
  <h3 className="font-bold text-lg mb-2">Card Title</h3>
  <p className="text-sm">Content goes here</p>
</div>
```

### Inputs
```tsx
<input className="border-2 border-foreground bg-background px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2" />
```

## Border Guidelines

### Border Widths
- **Standard**: 2px (most UI elements)
- **Emphasis**: 3-4px (primary actions, focus states)
- **Subtle**: 1px (dividers, less important borders)

### Border Radius
**Never use border-radius**. All corners are sharp 90° angles.

## Spacing System

Based on 4px grid:
```css
--space-1: 0.25rem   /* 4px */
--space-2: 0.5rem    /* 8px */
--space-3: 0.75rem   /* 12px */
--space-4: 1rem      /* 16px */
--space-6: 1.5rem    /* 24px */
--space-8: 2rem      /* 32px */
--space-12: 3rem     /* 48px */
--space-16: 4rem     /* 64px */
```

## Accessibility

### Contrast
All text meets WCAG AAA standards:
- Black on white: 21:1
- Dark gray on light: 4.5:1+

### Focus States
Always visible with 2px outline:
```css
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
```

### Keyboard Navigation
- Tab order follows visual hierarchy
- All interactive elements keyboard-accessible
- Shortcuts shown in tooltips (Cmd/Ctrl + K pattern)

## File Formats

### For Development
- **SVG** - Logo, icons, vector graphics
- **CSS Variables** - Colors, spacing, typography

### For Export
- **PNG** - Raster images at 1x and 2x
- **WebP** - Optimized web images
- **ICO** - Favicons (generated from PNG)

## Don'ts

- ❌ Don't use gradients
- ❌ Don't use shadows (except focus rings)
- ❌ Don't use rounded corners
- ❌ Don't use opacity < 100% for borders
- ❌ Don't use system fonts (keep JetBrains Mono)
- ❌ Don't use color for state alone (pair with icons/text)
- ❌ Don't animate borders or scale transforms

## Social Media Specs

### OpenGraph (og:image)
- Size: 1200×630px
- Format: PNG or WebP
- Include logo + tagline on solid background

### Twitter Card
- Size: 1200×600px
- Format: PNG or WebP
- Minimum safe area: 1000×500px (center)

### App Icons (if building mobile)
iOS: 180×180px (exported from 512px version)
Android: 192×192px (adaptive icon layers)

---

**Version**: 1.0
**Updated**: 2026-01-22
**License**: Internal use only
