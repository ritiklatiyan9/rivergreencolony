import { useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import LocomotiveScroll from 'locomotive-scroll';
import 'locomotive-scroll/locomotive-scroll.css';

gsap.registerPlugin(ScrollTrigger);

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

// Wraps each word of a headline's own text (not its <em> accent) in a mask,
// so the words can rise into place. Idempotent; React leaves the static text alone.
function splitWords(heading) {
  if (heading.dataset.split) return [...heading.querySelectorAll(':scope > .split-word > span')];
  const words = [];
  [...heading.childNodes].forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return;
    const fragment = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (!part.trim()) { fragment.append(part); return; }
      const mask = document.createElement('span'), word = document.createElement('span');
      mask.className = 'split-word'; word.textContent = part; mask.append(word); fragment.append(mask); words.push(word);
    });
    node.replaceWith(fragment);
  });
  heading.dataset.split = '1';
  return words;
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
 * Native document scrolling is retained: Locomotive v5 needs no scrollerProxy.
 */
export default function useSiteMotion(rootRef, reducedMotion = false) {
  const stateRef = useRef({ root: null, locomotive: null, reduced: reducedMotion });
  const heroEnteredRef = useRef(false);

  const scrollTo = useCallback((selector) => {
    if (typeof window === 'undefined') return false;

    const state = stateRef.current;
    const target = getTarget(selector, state.root);
    if (target === null) return false;

    const immediate = state.reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden;
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
    if (state.locomotive && !immediate) {
      state.locomotive.scrollTo(target, { offset, duration: 1.2, easing: scrollEase });
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
    let smoothReady = false;
    let smoothFrame = 0;
    let refreshFrame = 0;
    let readyFrame = 0;
    let layoutTimer = 0;
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
      cancelAnimationFrame(readyFrame);
      stateRef.current.locomotive = null;

      if (!smoothScroll) return;
      const instance = smoothScroll;
      smoothScroll = null;

      // v5 initializes its Core on the next frame. Let that frame finish before
      // destroying a just-created instance, otherwise its own RAF can restart.
      if (smoothReady) instance.destroy();
      else requestAnimationFrame(() => instance.destroy());
      smoothReady = false;
    };

    const refresh = () => {
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => {
        if (disposed) return;
        smoothScroll?.lenisInstance?.resize();
        smoothScroll?.resize();
        ScrollTrigger.refresh();
      });
    };

    const setup = () => {
      clearRevealTimers();
      destroySmoothScroll();
      animationContext?.revert();
      if (disposed) return;

      const reduced = Boolean(reducedMotion || motionQuery.matches);
      const hidden = document.hidden;
      const desktop = desktopQuery.matches;
      stateRef.current.reduced = reduced;

      // Starting on a cancellable frame avoids creating an instance during
      // React StrictMode's initial setup / cleanup / setup cycle.
      if (!reduced && !hidden && desktop) {
        smoothFrame = requestAnimationFrame(() => {
          if (disposed || document.hidden) return;
          try {
            smoothScroll = new LocomotiveScroll({
              lenisOptions: {
                lerp: 0.085,
                smoothWheel: true,
                syncTouch: false,
                anchors: false,
                autoRaf: false,
                prevent: (element) => Boolean(element.closest('[data-lenis-prevent], [role="dialog"]')),
              },
              scrollCallback: ScrollTrigger.update,
            });
            stateRef.current.locomotive = smoothScroll;
            readyFrame = requestAnimationFrame(() => {
              if (!disposed && smoothScroll) smoothReady = true;
            });
          } catch (error) {
            stateRef.current.locomotive = null;
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

          if (reduced || hidden) {
            heroEnteredRef.current = true;
            return;
          }

          const hero = root.querySelector('.hero');
          // The plum intro curtain (index.html) holds the stage for its first ~2 s.
          const introDelay = document.documentElement.classList.contains('intro-seen') || !document.querySelector('.intro-curtain') ? 0 : 1.75;
          // A plum frame with an arched top opens as the hero scrolls away.
          if (hero) gsap.fromTo(hero, { '--hero-frame': '3.4vw', '--hero-arch': desktop ? '9vw' : '18vw' }, {
            '--hero-frame': '0vw', '--hero-arch': '0vw', ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 30%', scrub: true },
          });
          // The script accent writes itself on, left to right.
          const writeOn = (accent, trigger, delay = 0) => accent && gsap.fromTo(accent,
            { clipPath: 'inset(-50% 100% -70% -30%)' },
            { clipPath: 'inset(-50% -30% -70% -30%)', duration: 1.5, delay, ease: 'power2.inOut', clearProps: 'clipPath',
              immediateRender: false, onStart: guardStartedReveal, scrollTrigger: { trigger, start: 'top 96%', once: true } });
          if (desktop && hero) root.querySelectorAll('[data-hero-depth]').forEach((layer) => {
            const depth = Number(layer.dataset.heroDepth);
            if (!Number.isFinite(depth) || depth === 0) return;
            // A 106%-high photograph has about 2.8% travel on either side.
            // Stay inside it so parallax never exposes an empty image edge.
            const travel = Math.min(Math.abs(depth) * 12, 2.5) * Math.sign(depth);
            gsap.fromTo(layer, { yPercent: travel }, {
              yPercent: -travel, ease: 'none',
              scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1 },
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

          const heroLines = root.querySelectorAll('.hero-title-line:not(em)'), heroAccent = root.querySelector('.hero h1 em');
          // A repeat visit shows the prerendered hero at first paint; animating it in again would flash.
          if (document.documentElement.classList.contains('intro-seen')) heroEnteredRef.current = true;
          if (heroLines.length && !heroEnteredRef.current) {
            const details = root.querySelectorAll('.hero-topline, .hero-subline, .hero-description, .hero-facts, .hero-frame');
            const detailTween = gsap.fromTo(details, { autoAlpha: 1, y: 12 }, { autoAlpha: 1, y: 0, duration: 1.25, delay: 0.3 + introDelay, stagger: 0.1, ease: 'power3.out' });
            const titleTween = gsap.fromTo(heroLines,
              { yPercent: 105, autoAlpha: 1 },
              {
                yPercent: 0,
                autoAlpha: 1,
                duration: 1.5,
                delay: introDelay,
                stagger: 0.14,
                ease: 'power4.out',
                onComplete: () => { heroEnteredRef.current = true; },
              },
            );
            const accentTween = heroAccent && gsap.fromTo(heroAccent, { clipPath: 'inset(-40% 100% -60% -20%)' }, { clipPath: 'inset(-40% -20% -60% -20%)', duration: 1.6, delay: introDelay + 0.55, ease: 'power2.inOut', clearProps: 'clipPath' });
            const guard = window.setTimeout(() => { revealTimers.delete(guard); finishRevealSoon(titleTween, detailTween, accentTween); }, introDelay * 1000);
            revealTimers.add(guard);
          }

          // Headlines: words rise out of masks, then the script accent writes on.
          root.querySelectorAll('main h2:not([data-line-reveal])').forEach((heading) => {
            if (heading.getBoundingClientRect().bottom < 0) return;
            const words = splitWords(heading);
            if (words.length) gsap.fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: 1.15, stagger: 0.06, ease: 'expo.out',
              immediateRender: false, onStart: guardStartedReveal, scrollTrigger: { trigger: heading, start: 'top 96%', once: true } });
            writeOn(heading.querySelector('em'), heading, words.length ? 0.35 : 0);
          });

          root.querySelectorAll('[data-line-reveal]').forEach((heading) => {
            if (heading.getBoundingClientRect().bottom < 0) return;
            gsap.fromTo(heading.querySelectorAll('.heading-line-mask > :not(em)'),
              { yPercent: 105 },
              { yPercent: 0, duration: 1.4, stagger: 0.14, ease: 'power4.out',
                immediateRender: false, onStart: guardStartedReveal,
                scrollTrigger: { trigger: heading, start: 'top 92%', once: true } },
            );
            writeOn(heading.querySelector('em'), heading, 0.5);
          });

          // Photographs open from a frame and settle in scale, on every device.
          root.querySelectorAll('.story-image, .feature-photo-wrap, .gallery-image, .location-map, .overview-inset').forEach((frame) => {
            if (frame.getBoundingClientRect().bottom < 0) return;
            const image = frame.querySelector('img');
            gsap.fromTo(frame, { clipPath: 'inset(10% 8% 10% 8%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.out', clearProps: 'clipPath',
              immediateRender: false, onStart: guardStartedReveal, scrollTrigger: { trigger: frame, start: 'top 94%', once: true } });
            if (image) gsap.fromTo(image, { scale: 1.2 }, { scale: 1, duration: 1.9, ease: 'expo.out', immediateRender: false, scrollTrigger: { trigger: frame, start: 'top 94%', once: true } });
          });

          root.querySelectorAll('[data-reveal]').forEach((element) => {
            if (element.getBoundingClientRect().bottom < 0) return;
            const requestedDelay = Number(element.dataset.revealDelay || 0);
            gsap.fromTo(element,
              { y: 24, autoAlpha: 0 },
              {
                y: 0,
                autoAlpha: 1,
                duration: 1.25,
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
                    scrub: 1.1,
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
      refresh();
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

    setup();
    // Filters, accordions and lazily mounted content can change document
    // height without loading a new image. Refresh once their layout settles,
    // rather than on every frame of a Framer Motion height transition.
    const layoutObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      window.clearTimeout(layoutTimer);
      layoutTimer = window.setTimeout(refresh, 120);
    });
    layoutObserver?.observe(root);
    motionQuery.addEventListener('change', setup);
    desktopQuery.addEventListener('change', setup);
    document.addEventListener('visibilitychange', setup);
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
      document.removeEventListener('visibilitychange', setup);
      document.removeEventListener('click', handleAnchor);
      root.removeEventListener('load', refresh, true);
      window.removeEventListener('resize', refresh);
      layoutObserver?.disconnect();
      window.clearTimeout(layoutTimer);
      clearRevealTimers();
      cancelAnimationFrame(refreshFrame);
      destroySmoothScroll();
      animationContext?.revert();
      stateRef.current.root = null;
    };
  }, [rootRef, reducedMotion, scrollTo]);

  return { scrollTo };
}
