export const THEME_CSS = `
  /* === text-scp-term variants === */
  .text-scp-term { color: var(--theme-accent) !important; }
  .text-scp-term\\/50 { color: var(--theme-accent) !important; opacity: 0.5; }
  .text-scp-term\\/60 { color: var(--theme-accent) !important; opacity: 0.6; }
  .text-scp-term\\/70 { color: var(--theme-accent) !important; opacity: 0.7; }
  .text-scp-term\\/80 { color: var(--theme-accent) !important; opacity: 0.8; }

  /* === bg-scp-term variants === */
  .bg-scp-term { background-color: var(--theme-accent) !important; }
  .bg-scp-term\\/10 { background-color: var(--theme-accent-soft) !important; }
  .bg-scp-term\\/20 { background-color: var(--theme-accent-soft) !important; }
  .bg-scp-term\\/40 { background-color: var(--theme-accent-soft) !important; }
  .bg-scp-term\\/50 { background-color: var(--theme-accent-soft) !important; }

  /* === border-scp-term variants === */
  .border-scp-term { border-color: var(--theme-accent) !important; }
  .border-scp-term\\/30 { border-color: var(--theme-accent-underline) !important; }
  .border-scp-term\\/40 { border-color: var(--theme-accent-underline) !important; }
  .border-scp-term\\/50 { border-color: var(--theme-accent-underline) !important; }
  .border-scp-term\\/60 { border-color: var(--theme-accent-underline) !important; }
  .border-l-scp-term { border-left-color: var(--theme-accent) !important; }
  .border-t-scp-term { border-top-color: var(--theme-accent) !important; }

  /* === fill / shadow / from / decoration === */
  .fill-scp-term { fill: var(--theme-accent) !important; }
  .shadow-scp-term\\/20 { --tw-shadow-color: var(--theme-accent-soft) !important; }
  .from-scp-term { --tw-gradient-from: var(--theme-accent) !important; }
  .decoration-scp-term { text-decoration-color: var(--theme-accent) !important; }
  .decoration-scp-term\\/50 { text-decoration-color: var(--theme-accent-underline) !important; }

  /* === focus states === */
  .focus\\:border-scp-term:focus { border-color: var(--theme-accent) !important; }
  .focus\\:ring-scp-term\\/50:focus { --tw-ring-color: var(--theme-accent-soft) !important; }

  /* === hover states === */
  @media (hover: hover) {
    .hover\\:bg-scp-term:hover { background-color: var(--theme-accent) !important; }
    .hover\\:bg-scp-term\\/10:hover { background-color: var(--theme-accent-soft) !important; }
    .hover\\:bg-scp-term\\/20:hover { background-color: var(--theme-accent-soft) !important; }
    .hover\\:bg-scp-term\\/40:hover { background-color: var(--theme-accent-soft) !important; }
    .hover\\:text-scp-term:hover { color: var(--theme-accent) !important; }
    .hover\\:border-scp-term:hover { border-color: var(--theme-accent) !important; }
    .hover\\:border-scp-term\\/50:hover { border-color: var(--theme-accent-underline) !important; }
    .hover\\:border-scp-term\\/60:hover { border-color: var(--theme-accent-underline) !important; }
    .hover\\:decoration-scp-term:hover { text-decoration-color: var(--theme-accent) !important; }
    .group:hover .group-hover\\:text-scp-term { color: var(--theme-accent) !important; }
    .group\\/btn:hover .group-hover\\/btn\\:text-scp-term { color: var(--theme-accent) !important; }
  }

  /* === active states === */
  .active\\:bg-scp-term\\/20:active { background-color: var(--theme-accent-soft) !important; }
  .active\\:bg-scp-term\\/60:active { background-color: var(--theme-accent-soft) !important; }

  /* === text shadow === */
  .text-shadow-green { text-shadow: 0 0 8px var(--theme-accent-glow) !important; }
`;
