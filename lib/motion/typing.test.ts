import { describe, expect, it } from "vitest";
import { latchedCharCount, typedCharCount } from "./typing";

const LEN = 176;

/** Desktop and laptop. The laptop case is the one that caught the real bug. */
const VIEWPORTS = [1002, 600];

const at = (elementTop: number, viewportHeight = 1002) =>
  typedCharCount({ elementTop, viewportHeight, textLength: LEN });

describe("typedCharCount", () => {
  it("shows nothing while the line is still below the fold", () => {
    expect(at(1002)).toBe(0);
    expect(at(2400)).toBe(0);
  });

  it("never returns a negative count, however far below the fold", () => {
    expect(at(100_000)).toBe(0);
  });

  it("has begun by the time the line is halfway up the viewport", () => {
    expect(at(1002 * 0.5)).toBeGreaterThan(0);
  });

  it("never exceeds the length of the string", () => {
    expect(at(-5000)).toBe(LEN);
  });

  it("increases monotonically as the line rises up the viewport", () => {
    const counts = [1000, 850, 700, 550, 400, 250, 0, -200].map((t) => at(t));
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
  });

  it("handles an empty string without producing a stray character", () => {
    expect(typedCharCount({ elementTop: 0, viewportHeight: 1002, textLength: 0 })).toBe(0);
  });

  // The regression. Section height used to drive this, and a tall section on a
  // short screen left the sentence unfinished until it was off-screen.
  it.each(VIEWPORTS)(
    "finishes while the line is still comfortably on screen (viewport %ipx)",
    (viewportHeight) => {
      // A third of the way up the viewport — still well within view.
      expect(at(viewportHeight * 0.35, viewportHeight)).toBe(LEN);
      expect(at(viewportHeight * 0.2, viewportHeight)).toBe(LEN);
    },
  );

  it.each(VIEWPORTS)(
    "has not started before the line has entered the viewport (viewport %ipx)",
    (viewportHeight) => {
      expect(at(viewportHeight, viewportHeight)).toBe(0);
    },
  );

  it("types at the same fractional point regardless of screen height", () => {
    // Same fractional position on two very different screens gives the same
    // result, which is the property that makes this viewport-relative.
    expect(at(1002 * 0.6, 1002)).toBe(at(600 * 0.6, 600));
  });
});

describe("latchedCharCount", () => {
  /** Walk a list of scroll positions the way the component would. */
  const play = (tops: number[]) => {
    let peak = 0;
    return tops.map((top) => {
      peak = latchedCharCount(peak, at(top));
      return peak;
    });
  };

  it("keeps the full line once it has been typed, when scrolling back up", () => {
    // down past the line, then all the way back to the top of the page
    const seen = play([1002, 700, 500, 300, 0, 300, 500, 700, 1002, 2000]);
    expect(seen.at(-1)).toBe(LEN);
    expect(seen.slice(4)).toEqual(Array(6).fill(LEN));
  });

  it("never gives back a character part-way through", () => {
    const seen = play([900, 800, 700, 900, 1002, 650, 900]);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it("holds a partial line steady when the reader scrolls away mid-sentence", () => {
    const [, partial, afterScrollingAway] = play([1002, 700, 2000]);
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(LEN);
    expect(afterScrollingAway).toBe(partial);
  });

  it("resumes forward from where it stopped rather than restarting", () => {
    const seen = play([1002, 700, 2000, 700, 400]);
    expect(seen[3]).toBe(seen[1]);
    expect(seen[4]).toBeGreaterThan(seen[3]);
  });
});
