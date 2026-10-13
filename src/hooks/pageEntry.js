// Animate the actual home heading throughout the entry. Each letter rises out
// of a mask, then this same h1 grows and settles as the foreground cover lifts.
function splitTitle(line) {
  const existing = line.querySelectorAll('.hero-title-letter');
  if (existing.length) return [...existing];
  const fragment = document.createDocumentFragment();
  const letters = [];
  line.textContent.split(/(\s+)/).forEach(part => {
    if (!part.trim()) { fragment.append(part); return; }
    const word = document.createElement('span');
    word.className = 'hero-title-word';
    for (const character of part) {
      const mask = document.createElement('span'), letter = document.createElement('span');
      mask.className = 'hero-title-letter-mask';
      letter.className = 'hero-title-letter'; letter.textContent = character;
      mask.append(letter); word.append(mask); letters.push(letter);
    }
    fragment.append(word);
  });
  line.replaceChildren(fragment);
  return letters;
}

export function playPageEntry(root, gsap) {
  const cover = document.querySelector('.site-loader');
  const heading = root.querySelector('.hero h1');
  const line = heading?.querySelector('.hero-title-line:not(em)');
  const accent = heading?.querySelector('em');
  if (!cover || !heading || !line || !document.documentElement.classList.contains('is-entering')) return null;
  let timeline, disposed = false, started = false, finished = false;
  let letters = [];
  const titleText = line.textContent;
  const timers = new Set();
  const wait = ms => new Promise(resolve => { const id = setTimeout(() => { timers.delete(id); resolve(); }, ms); timers.add(id); });
  const revealed = root.querySelectorAll('.site-header, .hero-topline, .hero-subline, .hero-booking, .hero-colony, .hero-bottom');
  const finish = (reason = 'complete') => {
    if (finished) return;
    finished = true;
    timeline?.kill();
    timers.forEach(clearTimeout); timers.clear();
    gsap.set(letters, { clearProps: 'transform' });
    // Letter masks are only needed for the entrance. Restore a continuous text
    // run so the finished heading gets the font's natural kerning and ligatures.
    if (letters.length) { line.textContent = titleText; letters = []; }
    gsap.set([heading, line, accent].filter(Boolean), { clearProps: 'opacity,visibility,transform' });
    gsap.set(revealed, { clearProps: 'opacity,visibility,transform' });
    window.__finishRivergreenEntry?.(reason);
    window.removeEventListener('wheel', skip, true);
    window.removeEventListener('touchstart', skip, true);
    window.removeEventListener('keydown', skip);
    cover.removeEventListener('click', skip);
    heading.removeEventListener('click', skip);
  };
  const skip = event => {
    if (event.type !== 'keydown' || ['Escape', 'Tab', ' ', 'ArrowDown', 'PageDown', 'End'].includes(event.key)) finish('input');
  };
  window.addEventListener('wheel', skip, { capture: true, passive: true });
  window.addEventListener('touchstart', skip, { capture: true, passive: true });
  window.addEventListener('keydown', skip);
  cover.addEventListener('click', skip);
  heading.addEventListener('click', skip);
  const image = root.querySelector('.hero-image');
  const readiness = Promise.allSettled([document.fonts?.ready, image?.decode?.()]);
  const hold = Math.max(0, 650 - (performance.now() - (window.__rivergreenEntryStarted || 0)));
  Promise.all([Promise.race([readiness, wait(1000)]), wait(hold)]).then(() => {
    if (disposed || finished || !document.documentElement.classList.contains('is-entering')) return;
    started = true;
    heading.setAttribute('aria-label', [line.textContent.trim(), accent?.textContent.trim()].filter(Boolean).join(' '));
    letters = splitTitle(line);
    gsap.set(heading, { y: 0, scale: 1, transformOrigin: 'center center' });
    const rect = heading.getBoundingClientRect();
    gsap.set(heading, {
      y: window.innerHeight * 0.46 - rect.top - rect.height * 0.5,
      scale: 0.55, transformOrigin: 'center center',
    });
    gsap.set(line, { visibility: 'visible' });
    gsap.set(letters, { yPercent: 120 });
    if (accent) gsap.set(accent, { autoAlpha: 0, y: 15 });
    timeline = gsap.timeline({ onComplete: finish });
    timeline.to(letters, { yPercent: 0, duration: 0.8, stagger: 0.045, ease: 'power4.out' }, 0);
    if (accent) timeline.to(accent, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.35);
    timeline.to(cover.querySelector('.site-loader-bg'), { yPercent: -100, duration: 1.2, ease: 'power4.inOut' }, 1)
      .to(heading, { y: 0, scale: 1, duration: 1.2, ease: 'power4.inOut' }, 1)
      .to(cover.querySelector('.site-loader-meta'), { opacity: 0, duration: 0.3 }, 1)
      .fromTo(revealed, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7, stagger: 0.045 }, 1.45);
  }).catch(() => finish('error'));
  return { finish, cancel() {
    disposed = true;
    if (started) finish('cancel');
    else {
      timers.forEach(clearTimeout); timers.clear();
      window.removeEventListener('wheel', skip, true);
      window.removeEventListener('touchstart', skip, true);
      window.removeEventListener('keydown', skip);
      cover.removeEventListener('click', skip);
      heading.removeEventListener('click', skip);
    }
  } };
}
