# Watercolor Share Cards with Image-Derived Palettes

**Date:** 2026-03-24
**Branch:** fix/feed-duplicate-art

## What was built

Rewrote the share card background renderer (`storyCardRenderer.ts`) to produce authentic watercolor effects using colors extracted from each artwork's image. Added a second export (`renderPostCard`) for Instagram 4:5 post format.

## Key changes

### Median Cut palette extraction
- Replaced naive bucket quantization with the Median Cut algorithm (same as color-thief)
- Recursively splits pixel population along widest RGB channel range
- Produces perceptually distinct color clusters
- 20% saturation boost + slight lightening for vivid watercolor washes

### Tyler Hobbs watercolor rendering (5-phase pipeline)
1. **Watercolor washes** — base polygons rendered as 60 deformed copies at 0.018 alpha with `multiply` compositing. Recursive midpoint displacement gives fractal organic edges.
2. **Blending washes** — smaller shapes between main washes for natural color bleeding
3. **Wet-on-wet blooms** — offset radial gradients at wash intersections
4. **Paint splatter** — tiny dots near wash areas
5. **Paper grain texture** — value noise overlay with multiply composite

### Legibility fade
- Vertical gradient from transparent to near-opaque warm white behind caption area
- Ensures title/artist/branding always readable regardless of watercolor colors

### Instagram post format
- `renderPostCard()` — 1080x1350 (4:5) with identical watercolor pipeline
- Scaled padding, fonts, and caption layout for the compact format

## Files changed

- `src/utils/storyCardRenderer.ts` — complete rewrite of background rendering + new export

## Patterns

- Tyler Hobbs polygon deformation (recursive midpoint displacement) is the industry standard for procedural watercolor
- `multiply` compositing mode is the digital equivalent of transparent watercolor glazing
- Median Cut > bucket quantization for perceptually distinct palette extraction
- Text legibility on variable watercolor backgrounds requires a dedicated fade layer
