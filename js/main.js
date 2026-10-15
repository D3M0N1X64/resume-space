/* ==========================================================
   Ashton Lee — résumé, "mission control" edition: page behavior
   Each feature lives in its own init function, called at the bottom.
   ========================================================== */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Theme toggle (light / dark) ----------
// The initial theme is set by a small script in <head> so the page doesn't flash.
function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('space-theme', next); } catch (e) { /* storage blocked: theme just won't be remembered */ }
  return next;
}

function initThemeToggle() {
  document.querySelector('.theme-toggle').addEventListener('click', toggleTheme);
}

// ---------- Mobile navigation ----------
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.getElementById('nav-links');

  function setOpen(isOpen) {
    links.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', () => {
    setOpen(!links.classList.contains('open'));
  });

  // Close the menu after picking a section
  links.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });
}

// ---------- Framing the hero photo ----------
// Where things sit in the Apollo 11 photo, as fractions of its (square) size.
// Earth's centre is the centre of the whole disc, including its unlit lower part.
// The horizon tilts slightly: lower at the photo's left edge than at its right.
const PHOTO = {
  earthX: 0.491, earthY: 0.346, earthR: 0.0742,
  horizon: 0.484, horizonLeft: 0.497, horizonRight: 0.471,
};

// Scale and place the photo so Earth lands right of the text (centred on narrow screens)
// and the horizon sits near the bottom, while still covering the whole hero.
// Shares the result with the CSS as custom properties and returns it for the starfield.
let sky = null;

function frameHero() {
  const hero = document.querySelector('.hero');
  const photo = document.querySelector('.scene-photo');
  const width = hero.clientWidth;
  const height = hero.clientHeight;
  const wide = width > 860;

  const targetX = (wide ? 0.68 : 0.5) * width;     // where Earth's centre should be
  const targetY = (wide ? 0.78 : 0.84) * height;   // where the horizon should be

  // The smallest size that puts Earth and the horizon there with no gaps at the edges
  const size = Math.max(
    targetX / PHOTO.earthX,
    (width - targetX) / (1 - PHOTO.earthX),
    targetY / PHOTO.horizon,
    (height - targetY) / (1 - PHOTO.horizon)
  );
  const left = targetX - PHOTO.earthX * size;
  const top = targetY - PHOTO.horizon * size;

  photo.style.backgroundSize = size + 'px ' + size + 'px';
  photo.style.backgroundPosition = left + 'px ' + top + 'px';
  // The light-mode sky mask is cut from the photo, so it is placed exactly the same way
  for (const layer of hero.querySelectorAll('.sky-tint, .sun')) {
    layer.style.maskSize = layer.style.webkitMaskSize = size + 'px ' + size + 'px';
    layer.style.maskPosition = layer.style.webkitMaskPosition = left + 'px ' + top + 'px';
  }

  // The horizon's height at any x across the hero, following the photo's tilt
  function horizonAt(x) {
    const across = (x - left) / size;
    const fraction = PHOTO.horizonLeft + (PHOTO.horizonRight - PHOTO.horizonLeft) * across;
    return top + fraction * size;
  }

  const sunX = (wide ? 0.9 : 0.85) * width;
  sky = {
    horizonAt,
    earthX: targetX,
    earthY: top + PHOTO.earthY * size,
    earthR: PHOTO.earthR * size,
  };
  const props = { '--sx': sunX, '--sy': horizonAt(sunX) };
  for (const [name, value] of Object.entries(props)) hero.style.setProperty(name, value + 'px');
  return sky;
}

function initHeroFraming() {
  frameHero();
  // The hero's height can change as fonts load or the window resizes
  new ResizeObserver(frameHero).observe(document.querySelector('.hero'));
}

// ---------- Starfield in the hero ----------
// Stars twinkle and drift slowly left in the black sky only: never over Earth or the Moon.
// Drawing pauses while the hero is off screen.
function initStarfield() {
  const canvas = document.querySelector('.starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];
  let width = 0;
  let height = 0;
  let running = false;

  // Real stars are mostly white, with some blue-white, yellow and the odd orange-red
  function starColor() {
    const roll = Math.random();
    if (roll < 0.6) return '#f4f7ff';
    if (roll < 0.78) return '#cfdcff';
    if (roll < 0.92) return '#fff1d2';
    return '#ffc9a0';
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    // Roughly one star per 4,500 square pixels
    const count = Math.round((width * height) / 4500);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() < 0.9 ? Math.random() * 1.1 + 0.3 : Math.random() * 1.2 + 1.2,
      speed: Math.random() * 0.06 + 0.01,
      phase: Math.random() * Math.PI * 2,
      color: starColor(),
    }));
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    for (const star of stars) {
      if (!reducedMotion) {
        star.x -= star.speed;
        if (star.x < -2) star.x = width + 2;
      }

      // Skip stars on the ground or in front of Earth, and fade them near the horizon
      // (real photos lose faint stars in the glare there)
      let fade = 1;
      if (sky) {
        const aboveHorizon = sky.horizonAt(star.x) - star.y;
        if (aboveHorizon < 6) continue;
        if (Math.hypot(star.x - sky.earthX, star.y - sky.earthY) < sky.earthR + 4) continue;
        fade = Math.min(1, aboveHorizon / 120);
      }

      const twinkle = 0.55 + 0.45 * Math.sin(time / 900 + star.phase);
      ctx.globalAlpha = (reducedMotion ? 0.7 : twinkle) * fade * 0.85;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame(time) {
    if (!running) return;
    draw(time);
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', () => {
    resize();
    if (reducedMotion) draw(0);
  });

  if (reducedMotion) {
    draw(0);
    return;
  }

  new IntersectionObserver((entries) => {
    const visible = entries[0].isIntersecting;
    if (visible && !running) {
      running = true;
      requestAnimationFrame(frame);
    } else if (!visible) {
      running = false;
    }
  }).observe(canvas);
}

// ---------- UTC clock on the telemetry panel ----------
function initClock() {
  const clock = document.getElementById('utc-clock');
  function tick() {
    clock.textContent = new Date().toISOString().slice(11, 19);
  }
  tick();
  setInterval(tick, 1000);
}

// ---------- Fade-in on scroll + filling skill gauges ----------
function initScrollReveal() {
  // Give each gauge its target width from data-level
  document.querySelectorAll('.meter').forEach((bar) => {
    bar.style.setProperty('--level', bar.dataset.level + '%');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      const meter = entry.target.querySelector('.meter');
      if (meter) meter.classList.add('filled');
      observer.unobserve(entry.target); // animate only once
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

// ---------- Terminal ----------
function initTerminal() {
  const form = document.getElementById('terminal-form');
  const input = document.getElementById('terminal-input');
  const output = document.getElementById('terminal-output');
  const history = [];
  let historyIndex = 0;

  // Add a line of text to the terminal. textContent keeps user input from being run as HTML.
  function print(text, type = 't-info') {
    const line = document.createElement('p');
    line.className = type;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  // Read names straight from the page so the terminal stays in sync with the content
  function listFromPage(selector) {
    return Array.from(document.querySelectorAll(selector))
      .map((el) => '  - ' + el.textContent.trim())
      .join('\n');
  }

  const commands = {
    help: () => print(
      'Available commands:\n' +
      '  help        show this list\n' +
      '  whoami      a short introduction\n' +
      '  skills      list skills\n' +
      '  experience  list roles\n' +
      '  education   list education\n' +
      '  accolades   list achievements\n' +
      '  contact     show my email\n' +
      '  theme       switch light and dark mode\n' +
      '  clear       clear the terminal'
    ),
    whoami: () => print(
      'Ashton Lee: network administrator, IT specialist and programmer.\n' +
      'Senior in Capella University\'s BS in Information Technology program.'
    ),
    skills: () => print('Skills:\n' + listFromPage('.skill-card h3')),
    experience: () => print('Experience:\n' + listFromPage('.mission-card h3')),
    education: () => print('Education:\n' + listFromPage('.edu-card h3')),
    accolades: () => print('Accolades:\n' + listFromPage('.accolade-card h3')),
    contact: () => {
      print('Email: ashton.redsky@gmail.com', 't-ok');
      setTimeout(() => document.getElementById('contact').scrollIntoView(), 700);
    },
    theme: () => {
      const theme = toggleTheme();
      print('Switched to ' + theme + ' mode.', 't-ok');
    },
    clear: () => { output.innerHTML = ''; },
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const raw = input.value.trim();
    input.value = '';
    if (!raw) return;

    history.push(raw);
    historyIndex = history.length;
    print('$ ' + raw, 't-user');

    const name = raw.split(/\s+/)[0].toLowerCase();
    if (commands[name]) {
      commands[name]();
    } else {
      print('Command not found: ' + name + '. Type help for the list.', 't-error');
    }
  });

  // Up/Down arrows move through previous commands
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' && historyIndex > 0) {
      historyIndex--;
      input.value = history[historyIndex];
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      historyIndex = Math.min(historyIndex + 1, history.length);
      input.value = history[historyIndex] || '';
      event.preventDefault();
    }
  });

  // Clicking anywhere on the terminal focuses the input (unless the visitor is selecting text)
  document.querySelector('.terminal').addEventListener('click', () => {
    if (!window.getSelection().toString()) input.focus({ preventScroll: true });
  });
}

// ---------- Contact: copy the email address ----------
function initCopyEmail() {
  const button = document.getElementById('copy-email');
  const status = document.getElementById('copy-status');

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.email);
      status.textContent = 'Address copied to clipboard.';
    } catch (e) {
      status.textContent = 'Copy not available here. The address is shown above.';
    }
    setTimeout(() => { status.textContent = ''; }, 3000);
  });
}

// ---------- Footer year ----------
function initYear() {
  document.getElementById('year').textContent = new Date().getFullYear();
}

// ---------- Start everything ----------
initThemeToggle();
initMobileNav();
initHeroFraming();
initStarfield();
initClock();
initScrollReveal();
initTerminal();
initCopyEmail();
initYear();
