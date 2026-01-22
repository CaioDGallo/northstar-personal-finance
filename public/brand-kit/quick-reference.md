# fluxo.sh Quick Reference

## Logo Usage

```html
<!-- React/TSX Component -->
<div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-background text-xs font-bold">
  FX$H
</div>
```

## Core Styles

### Colors
- **Background**: `#ffffff` / `hsl(0 0% 100%)`
- **Foreground**: `#000000` / `hsl(0 0% 0%)`
- **Muted**: `#f5f5f5` / `hsl(0 0% 96%)`
- **Destructive**: `#ef4444` / `hsl(0 84% 60%)`

### Typography
- **Font**: JetBrains Mono (400, 500, 700)
- **Base size**: 16px (1rem)
- **Scale**: 12/14/16/18/20/24/30px

### Borders
- **Standard**: 2px solid
- **Emphasis**: 3-4px solid
- **Radius**: 0 (always sharp corners)

### Spacing
- **Grid**: 4px base unit
- **Common**: 8px, 16px, 24px, 32px

## Component Patterns

### Primary Button
```tsx
<button className="border-2 border-foreground bg-foreground px-4 py-2 font-bold text-background hover:bg-background hover:text-foreground">
  Action
</button>
```

### Secondary Button
```tsx
<button className="border-2 border-foreground bg-background px-4 py-2 font-medium text-foreground hover:bg-muted">
  Cancel
</button>
```

### Card
```tsx
<div className="border-2 border-foreground bg-background p-4">
  <h3 className="mb-2 text-lg font-bold">Title</h3>
  <p className="text-sm">Content</p>
</div>
```

### Input
```tsx
<input className="border-2 border-foreground bg-background px-3 py-2 font-mono focus:ring-2 focus:ring-foreground focus:ring-offset-2" />
```

## Design Principles

### ✓ Do
- Use sharp corners (no border-radius)
- Use 2px borders minimum
- Use JetBrains Mono everywhere
- Maintain high contrast (black/white)
- Keep layouts grid-based
- Make keyboard navigation priority

### ✗ Don't
- Use gradients or shadows
- Use rounded corners
- Use fonts other than JetBrains Mono
- Use opacity < 100% for borders
- Use animations except hover transitions
- Hide keyboard shortcuts

## File Locations

- **SVG Logos**: `/public/brand-kit/logos/*.svg`
- **PNG Exports**: `/public/brand-kit/exports/*.png`
- **Examples**: `/public/brand-kit/examples.html`
- **Colors**: `/public/brand-kit/colors.json`

## Sizes Reference

| Size | Dimensions | Use Case |
|------|------------|----------|
| 16×16 | favicon-16 | Browser favicon |
| 32×32 | favicon-32 | Retina favicon |
| 48×48 | icon-48 | Small app icon |
| 96×96 | icon-96 | Medium app icon |
| 192×192 | icon-192 | PWA icon |
| 512×512 | icon-512 | PWA splash |

## Accessibility

- **Contrast ratio**: 21:1 (black/white)
- **Focus visible**: 2px outline with 2px offset
- **Text minimum**: 16px for body, 14px for UI
- **Touch targets**: 44×44px minimum

---

**Quick Links**:
- Full guidelines: `README.md`
- Visual examples: `examples.html`
- Color data: `colors.json`
