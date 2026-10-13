import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { createLayoutRefresh } from './layoutRefresh.js';
import { playPageEntry } from './pageEntry.js';

gsap.registerPlugin(ScrollTrigger);
// This hook owns layout refreshes. Automatic image/resize refreshes can reset
// Lenis while the visitor is still scrolling, including phone toolbar resizes.
if (typeof window !== 'undefined') {
  ScrollTrigger.config({ autoRefreshEvents: 'none', ignoreMobileResize: true });
  gsap.ticker.lagSmoothing(0);
}

const HEADER_OFFSET = 96;
const scrollEase = (value) => 1 - (1 - value) ** 4;

// Native smooth scrolling is cancelled by any other programmatic scroll: Framer
// Motion restores the scroll position after measuring a height:auto animation
// (the mobile menu closing), and ScrollTrigger does after every refresh (phone
// URL-bar resizes, lazily mounted content). So the window is eased frame by
// frame instead; each frame re-reads the live target, and the visitor's own
// touch, wheel or key input stops it.
const STOP_EVENTS = ['wheel', 'touchstart', 'keydown'];
function easeWindowTo(getTop, duration = 1100) {
  const from = window.scrollY, start = performance.now();
  let frame = 0;
  const stop = () => { cancelAnimationFrame(frame); STOP_EVENTS.forEach((type) => window.removeEventListener(type, stop)); };
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const end = Math.max(0, Math.min(getTop(), document.documentElement.scrollHeight - window.innerHeight));
    window.scrollTo({ top: from + (end - from) * scrollEase(t), behavior: 'instant' });
    if (t < 1) frame = requestAnimationFrame(step); else stop();
  };
  STOP_EVENTS.forEach((type) => window.addEventListener(type, stop, { passive: true }));
  frame = requestAnimationFrame(step);
  return stop;
}

// Wrap headline/statement words in masks, keeping emphasis and line breaks.
// Existing masks are retained through media changes and React updates.
function splitWords(heading) {
  const wrap = (element) => {
    [...element.childNodes].forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'EM') { wrap(node); return; }
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return;
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (!part.trim()) { fragment.append(part); return; }
        const mask = document.createElement('span'), word = document.createElement('span');
        mask.className = 'split-word'; word.textContent = part; mask.append(word); fragment.append(mask);
      });
      node.replaceWith(fragment);
    });
  };
  wrap(heading);
  heading.dataset.split = '1';
  return [...heading.querySelectorAll('.split-word > span')];
}

function getTarget(selector, root) {
  if (typeof selector === 'number') return selector;
  if (selector instanceof HTMLElement) return selector;
  if (typeof selector !== 'string') return null;
  if (selector === 'top' || selector === '#') return 0;
  if (selector === 'bottom') {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  try {
    if (selector.startsWith('#')) {
      return document.getElementById(decodeURIComponent(selector.slice(1)));
    }
    return root?.querySelector(selector) ?? document.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * GSAP owns reveal/parallax/hero elements; Framer Motion can own their wrappers.
 * Lenis and ScrollTrigger share GSAP's clock; touch scrolling stays native.
 */
export default function useSiteMotion(rootRef, reducedMotion = false, onStoryStep) {
  const stateRef = useRef({ root: null, lenis: null, reduced: reducedMotion });
  const heroEnteredRef = useRef(false);
  const [activeSection, setActiveSection] = useState('#home');

  const scrollTo = useCallback((selector, { immediate: forceImmediate = false } = {}) => {
    if (typeof window === 'undefined') return false;

    const state = stateRef.current;
    const target = getTarget(selector, state.root);
    if (target === null) return false;

    const immediate = forceImmediate || state.reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden;
    const headerHeight = state.root?.querySelector('.site-header')?.offsetHeight || HEADER_OFFSET;
    const offset = typeof target === 'number' ? 0 : -(headerHeight + 16);

    if (typeof selector === 'string' && selector.startsWith('#') && selector.length > 1) {
      if (window.location.hash !== selector) window.history.pushState(null, '', selector);
    }

    // Keep the next Tab press near the destination, as a native anchor does.
    if (target instanceof HTMLElement) {
      const hadTabIndex = target.hasAttribute('tabindex');
      if (!hadTabIndex) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (!hadTabIndex) target.removeAttribute('tabindex');
    }

    state.stopEase?.();
    window.__finishRivergreenEntry?.();
    if (state.lenis) {
      // Include newly mounted sections before clamping a navigation target.
      state.lenis.dimensions.resize();
      state.lenis.start();
      state.lenis.scrollTo(target, immediate ? { offset, immediate: true, force: true } : { offset, duration: 1.1, lerp: 0, easing: scrollEase, force: true });
    } else {
      const top = () => (typeof target === 'number'
        ? target
        : target.getBoundingClientRect().top + window.scrollY + offset);
      if (immediate) window.scrollTo({ top: Math.max(0, top()), behavior: 'instant' });
      else state.stopEase = easeWindowTo(top);
    }
    return true;
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktopQuery = window.matchMedia('(min-width: 900px) and (pointer: fine)');
    let disposed = false;
    let animationContext;
    let smoothScroll;
    let smoothFrame = 0;
    let smoothTick;
    let entry;
    let anchorTimer;
    let lastScroll = 0;
    const revealTimers = new Set();

    stateRef.current.root = root;

    const clearRevealTimers = () => {
      revealTimers.forEach((timer) => window.clearTimeout(timer));
      revealTimers.clear();
    };

    // A background or throttled browser can stop GSAP's RAF between frames.
    // Readability must not depend on the animation clock continuing to tick.
    const finishRevealSoon = (...tweens) => {
      const timer = window.setTimeout(() => {
        revealTimers.delete(timer);
        if (disposed) return;
        tweens.forEach((tween) => {
          if (tween && tween.totalProgress() < 1) tween.totalProgress(1);
        });
      }, 2200);
      revealTimers.add(timer);
    };

    function guardStartedReveal() {
      finishRevealSoon(this);
    }

    const destroySmoothScroll = () => {
      cancelAnimationFrame(smoothFrame);
      if (smoothTick) gsap.ticker.remove(smoothTick);
      smoothTick = null;
      stateRef.current.lenis = null;
      smoothScroll?.destroy();
      smoothScroll = null;
    };

    const layoutRefresh = createLayoutRefresh({
      readSize: () => ({ width: root.offsetWidth, height: root.offsetHeight, viewport: window.innerHeight }),
      isScrolling: () => document.hidden || document.documentElement.classList.contains('is-entering') ||
        performance.now() - lastScroll < 180 || Boolean(smoothScroll?.isScrolling),
      refresh: () => {
        if (disposed) return;
        // Updating dimensions does not reset targetScroll like lenis.resize().
        smoothScroll?.dimensions.resize();
        ScrollTrigger.refresh();
      },
    });
    const refresh = () => layoutRefresh.request();
    const markScroll = () => { lastScroll = performance.now(); window.clearTimeout(anchorTimer); layoutRefresh.touch(); };
    const finishEntry = (event) => {
      entry?.finish(event?.detail?.reason || 'complete');
      smoothScroll?.start();
      layoutRefresh.request(true);
      // Show the full entrance even on a section URL, then honour its target.
      // A visitor who skips with wheel/touch/keyboard keeps control of scrolling.
      const hash = window.__rivergreenEntryHash;
      if (event?.detail?.reason === 'complete' && hash && hash !== '#home' && window.location.hash === hash) {
        anchorTimer = window.setTimeout(() => { if (!disposed) scrollTo(hash); }, 350);
      }
    };

    const setup = () => {
      clearRevealTimers();
      destroySmoothScroll();
      animationContext?.revert();
      if (disposed) return;

      const reduced = Boolean(reducedMotion || motionQuery.matches);
      const desktop = desktopQuery.matches;
      stateRef.current.reduced = reduced;

      // Starting on a cancellable frame avoids creating an instance during
      // React StrictMode's initial setup / cleanup / setup cycle.
      if (!reduced && desktop) {
        smoothFrame = requestAnimationFrame(() => {
          if (disposed) return;
          try {
            smoothScroll = new Lenis({
              lerp: 0.1,
              smoothWheel: true,
              syncTouch: false,
              anchors: false,
              autoRaf: false,
              autoResize: false,
              prevent: (element) => Boolean(element.closest('[data-lenis-prevent], [role="dialog"]')),
            });
            stateRef.current.lenis = smoothScroll;
            smoothScroll.on('scroll', ScrollTrigger.update);
            smoothTick = (time) => { if (!document.hidden) smoothScroll?.raf(time * 1000); };
            // Advance scroll before GSAP renders animations in the same tick.
            gsap.ticker.add(smoothTick, false, true);
            if (document.hidden || document.documentElement.classList.contains('is-entering')) smoothScroll.stop();
          } catch (error) {
            stateRef.current.lenis = null;
            console.warn('Smooth scrolling is unavailable; native scrolling remains active.', error);
          }
        });
      }

      // Create the context first so even a failed setup can restore every style.
      animationContext = gsap.context(() => {}, root);
      try {
        animationContext.add(() => {
          const progress = root.querySelector('.scroll-progress');
          const progressFill = root.querySelector('.reading-progress-fill');
          const progressLabel = root.querySelector('.reading-progress-label');
          if (progress || progressFill || progressLabel) {
            const updateProgressLabel = ({ progress: value }) => {
              if (progressLabel) progressLabel.textContent = String(Math.round(value * 100)).padStart(2, '0');
            };
            const progressTimeline = gsap.timeline({
              defaults: { duration: 1, ease: 'none' },
              scrollTrigger: {
                start: 0,
                end: () => Math.max(1, ScrollTrigger.maxScroll(window)),
                scrub: true,
                invalidateOnRefresh: true,
                onUpdate: updateProgressLabel,
                onRefresh: updateProgressLabel,
              },
            });
            if (progress) progressTimeline.fromTo(progress,
              { scaleX: 0, transformOrigin: 'left center' },
              { scaleX: 1 },
              0,
            );
            if (progressFill) progressTimeline.fromTo(progressFill,
              { scaleY: 0, transformOrigin: 'center top' },
              { scaleY: 1 },
              0,
            );
          }

          // Section tracking and story selection also work with reduced motion.
          // Only the active chapter changes; no React updates on each scroll frame.
          root.querySelectorAll('main > section[id]').forEach((section) => {
            const chapterId = ({ everyday: '#overview', 'visit-process': '#at-a-glance' })[section.id] || `#${section.id}`;
            ScrollTrigger.create({
              trigger: section,
              start: 'top 45%',
              end: 'bottom 45%',
              onToggle: ({ isActive }) => { if (isActive) setActiveSection(chapterId); },
              onRefresh: ({ isActive }) => { if (isActive) setActiveSection(chapterId); },
            });
          });
          if (onStoryStep) {
            root.querySelectorAll('[data-story-step]').forEach((step) => {
              const selectStep = () => onStoryStep(Number(step.dataset.storyStep));
              ScrollTrigger.create({
                trigger: step,
                start: 'top 52%',
                end: 'bottom 52%',
                onEnter: selectStep,
                onEnterBack: selectStep,
                onRefresh: ({ isActive }) => { if (isActive) selectStep(); },
              });
            });
          }

          if (reduced) {
            heroEnteredRef.current = true;
            entry?.finish();
            window.__finishRivergreenEntry?.();
            return;
          }

          const hero = root.querySelector('.hero');
          if (desktop && hero) root.querySelectorAll('[data-hero-depth]').forEach((layer) => {
            const depth = Number(layer.dataset.heroDepth);
            if (!Number.isFinite(depth) || depth === 0) return;
            // A 106%-high photograph has about 2.8% travel on either side.
            // Stay inside it so parallax never exposes an empty image edge.
            const travel = Math.min(Math.abs(depth) * 12, 2.5) * Math.sign(depth);
            gsap.fromTo(layer, { yPercent: travel }, {
              yPercent: -travel, ease: 'none',
              scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
            });
          });

          root.querySelectorAll('[data-marquee]').forEach((track) => {
            const reverse = track.dataset.marquee === 'reverse';
            gsap.fromTo(track, { xPercent: reverse ? -25 : 0 }, {
              xPercent: reverse ? 0 : -25,
              ease: 'none',
              scrollTrigger: { trigger: track.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1.2 },
            });
          });

          root.querySelectorAll('[data-word-reveal]').forEach((statement) => {
            gsap.fromTo(statement.children, { opacity: 0.18, y: 5 }, {
              opacity: 1, y: 0, stagger: 0.045, ease: 'none',
              scrollTrigger: { trigger: statement, start: 'top 80%', end: 'bottom 40%', scrub: 1 },
            });
          });

          const heroLines = root.querySelectorAll('.hero-title-line:not(em)');
          // The first screen is readable at first paint. A short settling motion
          // gives it an arrival without a curtain or a hidden headline.
          if (document.documentElement.classList.contains('is-entering')) {
            heroEnteredRef.current = true;
          }
          if (heroLines.length && !heroEnteredRef.current) {
            const details = root.querySelectorAll('.hero-topline, .hero-subline, .hero-description, .hero-facts, .hero-frame');
            const detailTween = gsap.fromTo(details, { autoAlpha: 1, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.05, ease: 'power3.out' });
            const titleTween = gsap.fromTo(heroLines,
              { y: 10, autoAlpha: 1 },
              {
                y: 0,
                autoAlpha: 1,
                duration: 0.85,
                stagger: 0.08,
                ease: 'power4.out',
                onComplete: () => { heroEnteredRef.current = true; },
              },
            );
            finishRevealSoon(titleTween, detailTween);
          }

          // Serif headings rise word by word, following the reference's rhythm.
          root.querySelectorAll('main h2:not([data-line-reveal]), [data-heading-reveal]').forEach((heading) => {
            if (heading.getBoundingClientRect().bottom < 0) return;
            const words = splitWords(heading);
            if (words.length) gsap.fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: 0.85, stagger: 0.045, ease: 'expo.out',
              immediateRender: false, onStart: guardStartedReveal, scrollTrigger: { trigger: heading, start: 'top 96%', once: true } });
          });

          root.querySelectorAll('[data-line-reveal]').forEach((heading) => {
            if (heading.getBoundingClientRect().bottom < 0) return;
            gsap.fromTo(heading.querySelectorAll('.heading-line-mask > *'),
              { yPercent: 105 },
              { yPercent: 0, duration: 0.95, stagger: 0.09, ease: 'power4.out',
                immediateRender: false, onStart: guardStartedReveal,
                scrollTrigger: { trigger: heading, start: 'top 92%', once: true } },
            );
          });

          root.querySelectorAll('[data-reading-reveal]').forEach((statement) => {
            if (statement.getBoundingClientRect().bottom < 0) return;
            const words = splitWords(statement);
            gsap.fromTo(words, { opacity: 0.55, y: 4 }, {
              opacity: 1, y: 0, stagger: 0.035, ease: 'none',
              scrollTrigger: { trigger: statement, start: 'top 85%', end: 'bottom 40%', scrub: true },
            });
          });

          // Compositor transforms avoid repainting large clipped photographs.
          root.querySelectorAll('.story-image, .feature-photo-wrap, .gallery-image, .location-map, .overview-inset').forEach((frame) => {
            if (frame.getBoundingClientRect().bottom < 0) return;
            const image = frame.querySelector('img');
            gsap.fromTo(frame, { y: 18, opacity: 0.75 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
              immediateRender: false, onStart: guardStartedReveal, scrollTrigger: { trigger: frame, start: 'top 94%', once: true } });
            if (image && !frame.closest('.feature-story')) gsap.fromTo(image, { scale: 1.08 }, { scale: 1, duration: 1.25, ease: 'expo.out', immediateRender: false, scrollTrigger: { trigger: frame, start: 'top 94%', once: true } });
          });

          root.querySelectorAll('.project-guide > a, .glance-facts > div, .feature-step').forEach((element, index) => {
            gsap.fromTo(element, { y: 18, opacity: 0.55 }, {
              y: 0, opacity: 1, duration: 0.7, ease: 'power3.out',
              immediateRender: false, onStart: guardStartedReveal,
              delay: element.matches('.project-guide > a') ? index * 0.07 : 0,
              scrollTrigger: { trigger: element, start: 'top 92%', once: true },
            });
          });
          root.querySelectorAll('.section-top, .project-details, .story-position').forEach((element) => {
            element.classList.add('has-reveal-line');
            gsap.fromTo(element, { '--line-progress': 0 }, {
              '--line-progress': 1, duration: 0.8, ease: 'power2.inOut',
              immediateRender: false, onStart: guardStartedReveal,
              scrollTrigger: { trigger: element, start: 'top 94%', once: true },
            });
          });

          root.querySelectorAll('[data-reveal]').forEach((element) => {
            if (element.getBoundingClientRect().bottom < 0) return;
            const requestedDelay = Number(element.dataset.revealDelay || 0);
            gsap.fromTo(element,
              { y: 12, autoAlpha: 1 },
              {
                y: 0,
                autoAlpha: 1,
                duration: 0.8,
                immediateRender: false,
                onStart: guardStartedReveal,
                delay: Number.isFinite(requestedDelay) ? Math.max(0, Math.min(requestedDelay, 0.4)) : 0,
                ease: 'power3.out',
                scrollTrigger: { trigger: element, start: 'top 94%', once: true },
              },
            );
          });

          if (desktop) {
            root.querySelectorAll('[data-parallax]').forEach((element) => {
              gsap.fromTo(element,
                { yPercent: -2.5 },
                {
                  yPercent: 2.5,
                  ease: 'none',
                  scrollTrigger: {
                    trigger: element.parentElement,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true,
                    invalidateOnRefresh: true,
                  },
                },
              );
            });
          }
        });
      } catch (error) {
        animationContext.revert();
        console.warn('Scroll effects are unavailable; page content remains visible.', error);
      }
      layoutRefresh.request(true);
    };

    const handleAnchor = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor || !root.contains(anchor) || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.search !== window.location.search || !url.hash) return;
      if (!getTarget(url.hash, root)) return;
      event.preventDefault();
      scrollTo(url.hash);
    };

    if (document.documentElement.classList.contains('is-entering')) window.scrollTo({ top: 0, behavior: 'instant' });
    setup();
    entry = playPageEntry(root, gsap);
    // Observer notifications and image loads only schedule a measurement if
    // geometry actually changed. No refresh can interrupt wheel/touch inertia.
    const layoutObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refresh);
    layoutObserver?.observe(root);
    motionQuery.addEventListener('change', setup);
    desktopQuery.addEventListener('change', setup);
    const visibilityChange = () => {
      if (document.hidden) {
        entry?.finish('hidden');
        smoothScroll?.stop();
      } else {
        smoothScroll?.start();
        layoutRefresh.request(true);
      }
    };
    document.addEventListener('visibilitychange', visibilityChange);
    window.addEventListener('rg:entry-complete', finishEntry);
    window.addEventListener('scroll', markScroll, { passive: true });
    window.addEventListener('wheel', markScroll, { passive: true });
    window.addEventListener('touchmove', markScroll, { passive: true });
    // At document level React's click handlers run first. A link that handles
    // its own click can preventDefault without triggering a duplicate scroll.
    document.addEventListener('click', handleAnchor);
    root.addEventListener('load', refresh, true);
    window.addEventListener('resize', refresh, { passive: true });
    document.fonts?.ready.then(() => { if (!disposed) refresh(); });

    return () => {
      disposed = true;
      motionQuery.removeEventListener('change', setup);
      desktopQuery.removeEventListener('change', setup);
      document.removeEventListener('visibilitychange', visibilityChange);
      window.removeEventListener('rg:entry-complete', finishEntry);
      window.removeEventListener('scroll', markScroll);
      window.removeEventListener('wheel', markScroll);
      window.removeEventListener('touchmove', markScroll);
      document.removeEventListener('click', handleAnchor);
      root.removeEventListener('load', refresh, true);
      window.removeEventListener('resize', refresh);
      layoutObserver?.disconnect();
      layoutRefresh.dispose();
      window.clearTimeout(anchorTimer);
      entry?.cancel();
      clearRevealTimers();
      stateRef.current.stopEase?.();
      destroySmoothScroll();
      animationContext?.revert();
      stateRef.current.root = null;
    };
  }, [rootRef, reducedMotion, scrollTo, onStoryStep]);

  return { scrollTo, activeSection };
}
