/**
 * Geometry for the scroll-linked typing effect.
 *
 * Pure, and kept out of the component, so the behaviour that actually matters —
 * that it starts at zero, never exceeds the string, and reaches full length
 * while the line is still on screen — is unit-tested rather than eyeballed.
 *
 * Timing is measured against the typed line's own travel up the viewport, not
 * against its section's scroll range. An earlier version used the section, and
 * on a short viewport the sentence was still only 40% typed by the time it had
 * scrolled out of sight: the "how it works" section is tall because it holds
 * four boxes, but the line sits at the top of it, so section height was the
 * wrong ruler. Viewport fractions behave the same on every screen.
 */

/** Start typing once the line has risen to this fraction of the viewport. */
const START = 0.85;

/** Be finished by the time it reaches this one. */
const END = 0.35;

/**
 * Clamp a freshly computed count against the highest already reached, so a
 * character that has been revealed is never taken back.
 *
 * Without this the effect is symmetrical: scrolling back up un-types the line
 * and scrolling down types it again, so a reader moving around the page watches
 * the same sentence assemble itself repeatedly. Typing reads as something that
 * happened once. Replaying it makes it decoration.
 */
export function latchedCharCount(highestSoFar: number, target: number): number {
  return Math.max(highestSoFar, target);
}

/** How many characters should be showing, given where the line sits. */
export function typedCharCount({
  elementTop,
  viewportHeight,
  textLength,
}: {
  /** `getBoundingClientRect().top` of the typed line. */
  elementTop: number;
  viewportHeight: number;
  textLength: number;
}): number {
  const start = viewportHeight * START;
  const end = viewportHeight * END;
  const progress = Math.min(1, Math.max(0, (start - elementTop) / (start - end)));
  return Math.round(progress * textLength);
}
