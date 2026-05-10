// Single source of truth for the favicon. Served at /favicon.svg and
// referenced from every page, so a single edit here updates everywhere.
//
// Design: just the bracket pair `<>` from our wordmark, drawn as two
// stroked chevrons. Bold enough to read at 16px, simple enough to read
// at any size. The inline <style> with prefers-color-scheme means the
// same file works in light AND dark browser themes — strokes are dark
// on light backgrounds, light on dark.
//
// Browser support for SVG favicons + prefers-color-scheme: Chrome 80+,
// Firefox 41+, Safari 14+. Older browsers will fall back to whatever
// the user agent does for missing favicons (typically a default icon).

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<style>
  .mark{stroke:#0A0A0A;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}
  @media (prefers-color-scheme: dark){.mark{stroke:#FAFAFA}}
</style>
<path class="mark" d="M13 7 L5 16 L13 25"/>
<path class="mark" d="M19 7 L27 16 L19 25"/>
</svg>`;
