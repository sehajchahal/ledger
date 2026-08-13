"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Reveals children once, when they first scroll into view.
 *
 * Deliberately fails open. The CSS shows content by default; the `reveal-ready`
 * class that hides un-revealed elements is only added once this component has
 * mounted, and every element additionally reveals itself on a timer whether or
 * not its observer ever fires.
 *
 * That redundancy is the point. An earlier version hid content up front and
 * relied on an IntersectionObserver to bring it back, which meant any failure
 * in that one mechanism left whole sections of the page permanently blank —
 * a far worse outcome than a missing animation.
 */

/** Longest a element may stay hidden waiting for its observer. */
const FAILSAFE_MS = 1400;

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

    const show = () => {
      element.style.transitionDelay = `${delay}ms`;
      element.setAttribute("data-shown", "true");
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      show();
      return;
    }

    // Arm the hidden state only now that JS is definitely running.
    document.documentElement.classList.add("reveal-ready");

    // Anything already on screen at mount should not wait for a scroll event.
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      show();
      return;
    }

    const failsafe = window.setTimeout(show, FAILSAFE_MS);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        window.clearTimeout(failsafe);
        show();
        observer.disconnect();
      },
      { threshold: 0, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(element);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, [delay]);

  return (
    // @ts-expect-error — polymorphic tag; the union is narrower than JSX expects.
    <Tag ref={ref} className={`reveal ${className}`}>
      {children}
    </Tag>
  );
}
