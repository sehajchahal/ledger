"use client";

import { useEffect, useRef } from "react";

import { latchedCharCount, typedCharCount } from "@/lib/motion/typing";

/**
 * Types a line out character by character as it scrolls into view, with a
 * blinking cursor.
 *
 * Scroll position drives it, but only forwards: the count is latched at its
 * high-water mark, so scrolling back up leaves the line where it got to rather
 * than un-typing it. Once the sentence is complete the listeners come off
 * entirely — it has happened, and it does not happen again.
 *
 * Three copies of the text, each with one job:
 *
 *   sr-only  the accessible one. `visibility: hidden` drops an element out of
 *            the accessibility tree, so the ghost cannot serve this purpose and
 *            a reader would otherwise meet a paragraph that is empty until
 *            somebody scrolls.
 *   ghost    reserves the final width and height. Without it the surrounding
 *            layout reflows on every character, which moves the rest of the
 *            page while the reader is looking at it.
 *   live     the visible, growing one, and the thing the cursor hangs off.
 *
 * Text is written straight to the DOM rather than through state — a re-render
 * per character per scroll frame is a lot of React for one paragraph.
 */


export function ScrollType({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const live = liveRef.current;
    if (!wrap || !live) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      live.textContent = text;
      wrap.classList.add("is-done");
      return;
    }

    let frame = 0;
    /** Highest character count reached. The line never retreats below it. */
    let peak = 0;

    const detach = () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };

    const update = () => {
      frame = 0;
      const target = typedCharCount({
        elementTop: wrap.getBoundingClientRect().top,
        viewportHeight: window.innerHeight,
        textLength: text.length,
      });

      peak = latchedCharCount(peak, target);

      const next = text.slice(0, peak);
      if (live.textContent !== next) live.textContent = next;

      if (peak >= text.length) {
        wrap.classList.add("is-done");
        // Finished, and it cannot un-finish. Stop measuring on every frame.
        detach();
      }
    };

    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      detach();
    };
  }, [text]);

  return (
    <span ref={wrapRef} className={`type-wrap ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="type-ghost">
        {text}
      </span>
      <span aria-hidden="true" ref={liveRef} className="type-live" />
    </span>
  );
}
