---
name: Spiky Design System
colors:
  surface: '#111317'
  surface-dim: '#111317'
  surface-bright: '#37393e'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#1a1c20'
  surface-container: '#1e2024'
  surface-container-high: '#282a2e'
  surface-container-highest: '#333539'
  on-surface: '#e2e2e8'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#e2e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#adc6ff'
  on-tertiary: '#002e6a'
  tertiary-container: '#4d8eff'
  on-tertiary-container: '#00285d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#111317'
  on-background: '#e2e2e8'
  surface-variant: '#333539'
typography:
  display-xl:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-base:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-margin: 32px
  gutter: 24px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style

The design system is centered on the concept of "Financial Sentience"-a UI that feels alive, observant, and supportive. It targets a modern audience that views personal finance not as a chore, but as an evolving ecosystem managed by "Agentic AI."

The visual style is a blend of **Minimalism** and **Glassmorphism**, set against a deep, ink-like dark mode. By utilizing translucent layers, vibrant accent glows, and precise typography, the system creates an atmosphere of high-end, futuristic sophistication. The emotional response is one of calm control, clarity, and technological empowerment.

## Colors

The palette is anchored by a nearly black **Neutral** (#050505) to maximize the "Agentic AI" glow effects. 

- **Primary (Electric Purple):** Used for AI interaction states, primary calls-to-action, and "intelligence" indicators.
- **Secondary (Emerald Green):** Used for positive financial trends, success states, and growth metrics.
- **Tertiary (Soft Blue):** Used for informational data visualization, neutral trends, and secondary links.
- **Surface Strategy:** Layers are built using varying opacities of white over the black canvas, creating a "glass" effect rather than using solid grays. High-contrast white is reserved for primary text to ensure absolute readability.

## Typography

This design system utilizes **Geist** for its technical precision and neutral clarity, evoking a developer-grade but premium feel. 

- **Headlines:** Feature tight letter-spacing and bold weights to command attention against the dark background.
- **Data Labels:** **JetBrains Mono** is introduced for small labels and numerical data to reinforce the "OS" and "Technical Intelligence" vibe.
- **Readability:** Primary body text uses high-contrast white (`#FFFFFF`), while secondary descriptions use a 60% opacity to maintain hierarchy.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for desktop (1440px max-width) to maintain the "Dashboard" density, transitioning to a fluid stack for mobile.

- **Desktop:** A 12-column grid with generous 24px gutters. Dashboard "widgets" (cards) should span 3, 4, or 6 columns.
- **Mobile:** Single column with 16px side margins. 
- **Rhythm:** An 8px linear scale governs all spacing. Elements are grouped tightly (12px) to signify relationship, while sections are separated by larger gaps (48px) to provide visual "breath" in the dark interface.

## Elevation & Depth

Depth is created through **Glassmorphism** and **Tonal Layers** rather than traditional shadows.

1.  **Level 0 (Canvas):** Pure black background.
2.  **Level 1 (Cards/Containers):** Subtly translucent (`rgba(255,255,255, 0.03)`) with a 1px border (`rgba(255,255,255, 0.08)`) and a subtle background blur (12px).
3.  **Level 2 (Active/Hover):** Increased border brightness and a soft, primary-colored outer glow (15% opacity, 20px blur) to simulate the AI's "focus."
4.  **Floating Elements:** Modals and tooltips use a more opaque glass effect (80% blur) to ensure content isolation.

## Shapes

The shape language is consistently **Rounded**, striking a balance between organic and geometric.

- **Standard Containers:** 12px - 16px corner radius.
- **Buttons/Chips:** 8px or fully pill-shaped for interactive elements.
- **AI Glows:** Use soft, elliptical gradients with 0% hardness to create a "liquid" or "nebula" feel behind glass containers.

## Components

- **Buttons:** Primary buttons feature a subtle gradient (Primary to Tertiary) with white text. Secondary buttons are "Ghost" style with a 1px border.
- **Input Fields:** Darker than the card background, using a focus state that triggers a subtle primary glow around the entire input.
- **Data Visualization:** Line charts use 2px strokes with a gradient fill below the line that fades to transparent.
- **Chips:** Small, high-contrast pills with JetBrains Mono text for tagging transaction categories.
- **Agentic AI Indicators:** A small, animated "pulsing" orb or gradient border used when the system is "thinking" or providing a financial insight.
- **Cards:** Content is padded by 24px internally. Titles are always positioned top-left, with secondary actions (like "View More") positioned top-right in a muted label style.