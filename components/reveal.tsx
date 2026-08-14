"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Reveals children once, when they first scroll into view.
 *
 * Deliberately fails open. The CSS shows content by default; the `reveal-ready`
 * class that hides un-revealed elements is only added once this component has
 * mounted, so if the script never runs the page still reads.
 *
 * One shared, frame-throttled sweep drives every instance. An earlier version
 * used an IntersectionObserver per element plus a 1400ms timer that showed the
 * element whether or not the observer had fired. The timer was there because
 * the observer had once failed outright and left whole sections blank — but it
 * meant that a second and a half after load, every reveal on the page had run,
 * including ones several thousand pixels down. Scrolling to them showed nothing
 * because the animation had already finished. This version keeps the fail-open
 * property without that: the fallback is geometry, checked on scroll, so an
 * element is only ever revealed when it is actually in view.
 */

/** Reveal once the element's top edge is this far up the viewport. */
const TRIGGER_RATIO = 0.92;

const pending = new Set<HTMLElement>();
let listening = false;
let frame = 0;

function sweep() {
  frame = 0;
  const limit = window.innerHeight * TRIGGER_RATIO;

  for (const element of pending) {
    // `top < limit` also catches anything already scrolled past, so jumping to
    // an anchor never strands an element in the hidden state.
    if (element.getBoundingClientRect().top < limit) {
      element.setAttribute("data-shown", "true");
      pending.delete(element);
    }
  }

  if (pending.size === 0) stopListening();
}

function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(sweep);
}

function startListening() {
  if (listening) return;
  listening = true;
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}

function stopListening() {
  if (!listening) return;
  listening = false;
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
}

export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  /** Stagger, in ms. Keep the total under ~300ms across a group. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.setAttribute("data-shown", "true");
      return;
    }

    // Arm the hidden state only now that JS is definitely running.
    document.documentElement.classList.add("reveal-ready");
    element.style.transitionDelay = `${delay}ms`;

    // Resolve above-the-fold content synchronously, in the same tick that armed
    // the hiding rule. Deferring to the next frame would flash it hidden.
    if (element.getBoundingClientRect().top < window.innerHeight * TRIGGER_RATIO) {
      element.setAttribute("data-shown", "true");
      return;
    }

    pending.add(element);
    startListening();

    return () => {
      pending.delete(element);
      if (pending.size === 0) stopListening();
    };
  }, [delay]);

  return (
    // @ts-expect-error — polymorphic tag; the union is narrower than JSX expects.
    <Tag ref={ref} className={`reveal ${className}`}>
      {children}
    </Tag>
  );
}
