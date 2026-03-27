## Design Context

The user uses shacdn/ui lib, consider using it when appropriate.

### Users
Software developers, students, and educators working with UML-like modeling and code generation using the Umple language. They arrive with a task in mind (model a system, generate code, learn Umple) and need the tool to feel immediately legible and trustworthy — like a university-grade instrument, not a toy.

### Brand Personality
**Academic, precise, trustworthy.** The interface should feel like a reliable professional tool backed by institutional credibility (uOttawa). Every interaction should communicate competence and correctness. The tone is direct and informative — no whimsy, no marketing fluff.

### Emotional Goals
- **Confidence & clarity** — Users should always know what's happening. State changes (compiling, errors, success) must be unambiguous. The tool should feel predictable and honest.
- **Flow & efficiency** — Nothing should interrupt the user's thinking. Minimize modal interruptions, reduce clicks, support keyboard-driven workflows. The UI should stay out of the way.

### Aesthetic Direction
- **Visual tone**: Clean, information-dense, quietly refined. Closer to a professional IDE than a marketing site, but with the polish of modern SaaS tools.
- **References**: VS Code/Cursor (keyboard-driven power), Excalidraw/tldraw (lightweight visual tools), Figma/Linear (refined typography and interactions), Go/TS Playground (simple editor+output paradigm).
- **Anti-references**: Overly decorative dashboards, heavy illustration, gamified UIs, anything that prioritizes style over function.
- **Theme**: Light and dark modes. uOttawa garnet (#8f001a) as the singular brand accent — used sparingly for CTAs and active states, never overwhelming.

### Design Principles
1. **Clarity over cleverness** — Every element should communicate its purpose instantly. Prefer explicit labels over icons-only, obvious states over subtle cues.
2. **Density without clutter** — Show useful information compactly (like an IDE), but maintain clear visual hierarchy through spacing, typography weight, and color restraint.
3. **Keyboard-first, mouse-friendly** — All core workflows should be achievable via keyboard. Mouse interactions should feel equally natural, never like a fallback.
4. **Quiet until needed** — Status indicators, errors, and secondary controls should stay visually recessive until they become relevant. The editor and diagram are always the focal point.
5. **Institutional trust** — The interface should feel like it belongs to a university research tool. Consistency, precision, and reliability in every detail.

### Accessibility
- Target: **WCAG 2.1 AA** compliance
- Minimum 4.5:1 contrast ratio for all text
- All interactive elements keyboard-navigable with visible focus indicators
- Semantic HTML and ARIA attributes on custom components
- Support for `prefers-reduced-motion` and `prefers-color-scheme`
