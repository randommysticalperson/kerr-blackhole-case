# Design Ideas: Kerr Black Hole WebGPU — Showcase Page

## Selected Approach: "Deep-Space Instrument"

**Design Movement:** Scientific Observatory meets Cinematic Space Visualization
**Core Principles:**
1. True black canvas — no grey, no washed-out backgrounds; pure #000005 depth
2. Asymmetric, left-anchored layout — avoids centered "AI slop" aesthetic
3. Physics-forward — equations and parameters are first-class visual elements
4. Layered depth — subtle glows, grain, and blur create atmosphere without clutter

**Color Philosophy:**
- Background: #000005 (near-absolute black)
- Primary accent: electric cyan #00E5FF (cold, scientific, photon-ring reference)
- Secondary accent: warm amber #FFB347 (hot, accretion disk, Doppler blueshift contrast)
- Text: white/90 for headings, white/50 for body, white/20 for captions
- Borders: cyan/10 to cyan/30 — hairline, instrument-panel style

**Layout Paradigm:**
- Hero: full-bleed image with left-aligned text overlay, no centered cards
- Sections alternate: left-heavy text + right image, then right-heavy text + left image
- Physics section: monospaced equation blocks in a grid, not a list
- Feature cards: horizontal instrument-panel rows, not rounded cards

**Signature Elements:**
1. Thin cyan `border-left` on section labels (matches the app's own ControlPanel style)
2. Monospaced parameter readouts beside headings (e.g., `a = 0.998 M`)
3. Subtle scanline/grain overlay on the hero

**Typography System:**
- Display: Space Grotesk (700) — bold, geometric, space-domain
- Data/labels: Space Mono (400/700) — monospaced, instrument-panel feel
- Body: Space Grotesk (400) — consistent family, readable

**Animation:**
- Hero text: staggered fade-up on load
- Section reveals: intersection-observer triggered fade-in from below
- Hover on feature cards: thin cyan left-border brightens + subtle background glow
- No bouncing, no excessive spring physics
