/**
 * Single import site for KaTeX stylesheet.
 * Components that render math should import this module (side-effect only) instead of
 * `katex/dist/katex.min.css` directly so the CSS lands in one shared chunk and stays
 * out of the root layout.
 */
import "katex/dist/katex.min.css";
