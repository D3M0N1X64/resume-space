/* ==========================================================
   Ashton Lee — résumé, "mission control" edition: page behavior
   Each feature lives in its own init function, called at the bottom.
   ========================================================== */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Light / dark theme ----------
// The initial theme is set by a small script in <head> so the page doesn't flash.
function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('space-theme', next); } catch (e) { /* storage blocked: theme just won't be remembered */ }
  document.dispatchEvent(new CustomEvent('themechange', { detail: next }));   // eggs.js listens
  return next;
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
  const props = {
    '--sx': sunX, '--sy': horizonAt(sunX),
    '--ex': sky.earthX, '--ey': sky.earthY, '--er': sky.earthR,
  };
  for (const [name, value] of Object.entries(props)) hero.style.setProperty(name, value + 'px');
  hero.classList.add('framed');
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

// ---------- Terminal commands ----------
// Shared by the site's terminal and the access screen, so both answer the same way.
// print(text, type) adds a line, append(node) adds an element, clear() empties the screen;
// extraHelp adds lines to "help", and onContact runs after "contact". Each command gets the
// words typed after it. The hidden easter-egg commands come from eggs.js.
function terminalCommands({ print, append, clear, extraHelp = '', onContact }) {
  // Read names straight from the page so the terminal stays in sync with the content
  function listFromPage(selector) {
    return Array.from(document.querySelectorAll(selector))
      .map((el) => '  - ' + el.textContent.trim())
      .join('\n');
  }

  const commands = {
    help: () => print(
      'Available commands:\n' +
      extraHelp +
      '  help        show this list\n' +
      '  whoami      a short introduction\n' +
      '  skills      list skills\n' +
      '  experience  list roles\n' +
      '  education   list education\n' +
      '  accolades   list awards and honors\n' +
      '  contact     show my email\n' +
      '  mobile      preview the site on phone screens\n' +
      '  theme       switch light and dark mode\n' +
      '  achievements  easter eggs you\'ve found\n' +
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
      if (onContact) onContact();
    },
    // Opens mobile.html (the site in phone-sized frames) in a new tab
    mobile: () => {
      if (window.innerWidth < 600) {
        print('You\'re already on a phone-sized screen, so this is the mobile layout.', 't-ok');
        return;
      }
      const tab = window.open('mobile.html', '_blank');
      if (tab) print('Opening the phone preview in a new tab.', 't-ok');
      else print('Pop-up blocked. Open mobile.html on this site to see the preview.', 't-error');
    },
    theme: () => {
      const theme = toggleTheme();
      print('Switched to ' + theme + ' mode.', 't-ok');
    },
    clear,
  };
  return Object.assign(hiddenCommands({ print, append }), commands);
}

// Up/Down arrows in a terminal input move through previous commands
function commandHistory(input) {
  const history = [];
  let index = 0;

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' && index > 0) {
      index--;
      input.value = history[index];
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      index = Math.min(index + 1, history.length);
      input.value = history[index] || '';
      event.preventDefault();
    }
  });

  return (command) => {
    history.push(command);
    index = history.length;
  };
}

// ---------- Terminal ----------
function initTerminal() {
  const form = document.getElementById('terminal-form');
  const input = document.getElementById('terminal-input');
  const output = document.getElementById('terminal-output');
  const remember = commandHistory(input);

  // Add a line of text to the terminal. textContent keeps user input from being run as HTML.
  function print(text, type = 't-info') {
    const line = document.createElement('p');
    line.className = type;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  const commands = terminalCommands({
    print,
    append: (node) => {
      output.appendChild(node);
      output.scrollTop = output.scrollHeight;
    },
    clear: () => { output.innerHTML = ''; },
    onContact: () => setTimeout(() => document.getElementById('contact').scrollIntoView(), 700),
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const raw = input.value.trim();
    input.value = '';
    if (!raw) return;

    remember(raw);
    print('$ ' + raw, 't-user');

    const [word, ...args] = raw.split(/\s+/);
    const name = word.toLowerCase();
    if (commands[name]) {
      commands[name](args);
    } else {
      print('Command not found: ' + name + '. Type help for the list.', 't-error');
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

// ---------- The MFD frame: keys, labels and scroll position ----------
// The site is shown on the screen of a cockpit display. The labels on the screen's edges
// are the real links and buttons; each key in the bezel presses the label beside it.
// boot is the access screen (for RESET).
function initFrame(boot) {
  const frame = document.getElementById('mfd');

  // A key presses whichever label is showing beside it (the access screen has its own set)
  frame.querySelectorAll('.osb').forEach((key) => {
    key.addEventListener('click', (event) => {
      const label = Array.from(frame.querySelectorAll('.lbl[data-key="' + key.dataset.key + '"]'))
        .find((el) => el.getClientRects().length && getComputedStyle(el).visibility === 'visible');
      if (label) {
        label.click();
        event.stopPropagation();   // the label handled it; don't also count as a click on the display
      }
    });
  });

  // Sections in page order, for PREV / NEXT and for boxing the current one in the top labels
  const navLabels = Array.from(frame.querySelectorAll('.mfd-labels-top .lbl'));
  const sections = [document.getElementById('home')]
    .concat(navLabels.map((label) => document.querySelector(label.getAttribute('href'))));
  const thumb = frame.querySelector('.mfd-scroll span');
  let current = 0;

  function update() {
    const page = document.documentElement;
    const line = parseFloat(getComputedStyle(page).scrollPaddingTop) + 60;
    current = 0;
    sections.forEach((section, i) => {
      if (section.getBoundingClientRect().top <= line) current = i;
    });
    // At the very bottom, the last section counts as current even if it's short
    if (window.innerHeight + window.scrollY >= page.scrollHeight - 2) current = sections.length - 1;

    navLabels.forEach((label, i) => {
      const active = i === current - 1;
      label.classList.toggle('is-active', active);
      if (active) label.setAttribute('aria-current', 'location');
      else label.removeAttribute('aria-current');
    });

    // The scroll marker on the right edge of the screen
    const visible = window.innerHeight / page.scrollHeight;
    const travel = page.scrollHeight - window.innerHeight;
    const size = Math.max(8, visible * 100);
    thumb.style.height = size + '%';
    thumb.style.top = (travel > 0 ? window.scrollY / travel : 0) * (100 - size) + '%';
  }

  let queued = false;
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  }, { passive: true });
  window.addEventListener('resize', update);
  update();

  function goTo(index) {
    const target = sections[Math.max(0, Math.min(sections.length - 1, index))];
    if (target === sections[0]) window.scrollTo({ top: 0 });
    else target.scrollIntoView();
  }

  const actions = {
    theme: toggleTheme,
    prev: () => goTo(current - 1),
    next: () => goTo(current + 1),
    top: () => window.scrollTo({ top: 0 }),
    'page-up': () => window.scrollBy({ top: -window.innerHeight * 0.7 }),
    'page-down': () => window.scrollBy({ top: window.innerHeight * 0.7 }),
    print: () => window.print(),
    reset: () => boot.reset(),
  };

  frame.querySelectorAll('[data-action]').forEach((label) => {
    label.addEventListener('click', () => actions[label.dataset.action]());
  });
}

// ---------- ASCII globe for the access screen ----------
// A small Earth drawn in characters: continents from fractal noise sampled on a sphere (so
// they wrap around seamlessly), polar ice, sunlight from the upper left and a dark night
// side with scattered city lights. It turns west to east while the access screen is up, and
// spinHome() whirls it round to Alabama with a blinking marker. options.rows sets its size.
function createAsciiPlanet(pre, caption, options = {}) {
  const TAU = Math.PI * 2;
  const HOME = { lat: 32.8, lon: -86.8 };   // Alabama
  const MAP_W = 96;
  const MAP_H = 48;
  const SEA = '..,,-~';         // dim to bright; light strokes so land stands out
  const LAND = ':=+*#%@@';
  const SUN = { x: -0.45, y: -0.35, z: 0.82 };   // y points down the screen
  const sunLength = Math.hypot(SUN.x, SUN.y, SUN.z);

  // Repeatable pseudo-random value for a lattice point, 0..1
  function hash(x, y, z) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // Smooth value noise in 3D, and a few octaves of it layered for coastline detail
  function noise(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
    const lerp = (a, b, t) => a + (b - a) * t;
    const corner = (dx, dy, dz) => hash(ix + dx, iy + dy, iz + dz);
    return lerp(
      lerp(lerp(corner(0, 0, 0), corner(1, 0, 0), sx), lerp(corner(0, 1, 0), corner(1, 1, 0), sx), sy),
      lerp(lerp(corner(0, 0, 1), corner(1, 0, 1), sx), lerp(corner(0, 1, 1), corner(1, 1, 1), sx), sy),
      sz
    );
  }

  function fractal(x, y, z) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let octave = 0; octave < 4; octave++) {
      sum += amp * noise(x * freq, y * freq, z * freq);
      amp /= 2;
      freq *= 2;
    }
    return sum / 0.9375;
  }

  // The surface as a longitude/latitude grid: 0 sea, 1 land, 2 ice
  const surface = new Uint8Array(MAP_W * MAP_H);
  for (let j = 0; j < MAP_H; j++) {
    const lat = ((j + 0.5) / MAP_H - 0.5) * Math.PI;
    for (let i = 0; i < MAP_W; i++) {
      const lon = ((i + 0.5) / MAP_W) * TAU;
      const px = Math.cos(lat) * Math.cos(lon);
      const py = Math.sin(lat);
      const pz = Math.cos(lat) * Math.sin(lon);
      const height = fractal(px * 1.8 + 7.3, py * 1.8 + 2.1, pz * 1.8 + 5.7);
      surface[j * MAP_W + i] = Math.abs(lat) > 1.22 ? 2 : height > 0.56 ? 1 : 0;
    }
  }

  // For each character cell on the disc: where it lands on the globe and how much sun it gets
  let cells = [];
  let rows = 0;
  let cols = 0;

  function layout() {
    rows = options.rows || (window.matchMedia('(min-width: 760px)').matches ? 21 : 13);
    // Characters are taller than they are wide, so size the grid to keep the globe round
    const probe = document.createElement('span');
    probe.textContent = '0000000000';
    pre.replaceChildren(probe);
    const style = getComputedStyle(pre);
    const charWidth = probe.getBoundingClientRect().width / 10 || parseFloat(style.fontSize) * 0.6;
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize);
    cols = Math.round((rows * lineHeight) / charWidth);

    cells = [];
    for (let r = 0; r < rows; r++) {
      const y = ((r + 0.5) / rows) * 2 - 1;
      for (let c = 0; c < cols; c++) {
        const x = ((c + 0.5) / cols) * 2 - 1;
        const d = x * x + y * y;
        if (d > 1) {
          cells.push(null);
          continue;
        }
        const z = Math.sqrt(1 - d);
        const lat = Math.asin(-y);
        cells.push({
          row: Math.min(MAP_H - 1, Math.floor((lat / Math.PI + 0.5) * MAP_H)),
          lon: Math.atan2(x, z),
          light: (x * SUN.x + y * SUN.y + z * SUN.z) / sunLength,
          rim: d > 0.86,   // the edge of the disc, traced faintly on the night side
        });
      }
    }
  }

  let rotation = 0;
  let timer = null;
  let spin = null;      // an ease-out whirl toward home, while spinHome() runs
  let atHome = false;   // holding still on home, with the marker blinking
  let frozen = false;   // stopped for good: keep the marker showing

  function draw() {
    // Home sits in the middle column once the globe has turned to face it
    const markerRow = atHome ? Math.round(((1 - Math.sin((HOME.lat * Math.PI) / 180)) / 2) * rows - 0.5) : -1;
    const markerCol = Math.floor(cols / 2);
    const markerOn = frozen || Math.floor(performance.now() / 400) % 2 === 0;
    let out = '';
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++, k++) {
        const cell = cells[k];
        if (r === markerRow && c === markerCol && markerOn) {
          out += 'X';
          continue;
        }
        if (!cell) {
          out += ' ';
          continue;
        }
        // Subtracting the rotation moves features left to right, west to east
        const lon = (((cell.lon - rotation) / TAU) % 1 + 1) % 1;
        const i = Math.floor(lon * MAP_W);
        const type = surface[cell.row * MAP_W + i];
        const light = cell.light;
        if (light < 0.05) {
          // Night side: the faint edge of the disc, and a few city lights on land
          out += cell.rim || (type === 1 && hash(i, cell.row, 99) < 0.16) ? '.' : ' ';
          continue;
        }
        const ramp = type === 0 ? SEA : LAND;
        const boost = type === 2 ? 3 : 0;   // ice is brighter than land
        out += ramp[Math.min(ramp.length - 1, Math.floor(light * ramp.length) + boost)];
      }
      out += '\n';
    }
    pre.textContent = out;
    if (atHome) {
      caption.textContent = 'HOME · ALABAMA · 32.8°N 086.8°W';
      return;
    }
    // The longitude facing the viewer, written the usual way for Earth: 0–180° east or west
    let degrees = Math.round(((((-rotation / TAU) % 1) + 1) % 1) * 360);
    if (degrees > 180) degrees -= 360;
    const side = degrees === 0 || degrees === 180 ? '' : degrees > 0 ? 'E' : 'W';
    caption.textContent = 'EARTH · LON ' + String(Math.abs(degrees)).padStart(3, '0') + '°' + side;
  }

  function onResize() {
    if (timer === null) return;
    layout();
    draw();
  }
  window.addEventListener('resize', onResize);

  // One frame: follow the whirl if there is one, otherwise turn slowly (unless parked at home)
  function tick() {
    if (spin) {
      const t = Math.min(1, (performance.now() - spin.start) / spin.duration);
      rotation = spin.from + (spin.to - spin.from) * (1 - Math.pow(1 - t, 3));
      if (t === 1) {
        rotation = spin.to % TAU;
        const done = spin.done;
        spin = null;
        atHome = true;
        if (done) done();
      }
    } else if (!atHome) {
      rotation = (rotation + TAU / 400) % TAU;   // a full turn about every 24 seconds
    }
    draw();
  }

  function run() {
    clearInterval(timer);
    timer = setInterval(tick, 60);
  }

  return {
    start() {
      spin = null;
      atHome = false;
      frozen = false;
      layout();
      draw();
      if (!reducedMotion) run();
    },
    stop() {
      clearInterval(timer);
      timer = null;
      if (atHome) {
        frozen = true;
        draw();
      }
    },
    // Whirl round (a couple of turns, slowing down) until Alabama faces the viewer, then mark it
    spinHome(onDone) {
      const target = ((((-HOME.lon * Math.PI) / 180) % TAU) + TAU) % TAU;
      atHome = false;
      if (reducedMotion) {
        rotation = target;
        atHome = true;
        frozen = true;
        draw();
        if (onDone) onDone();
        return;
      }
      const ahead = (((target - rotation) % TAU) + TAU) % TAU;
      spin = { from: rotation, to: rotation + 2 * TAU + ahead, start: performance.now(), duration: 2600, done: onDone };
      if (timer === null) run();
    },
    // Back to turning slowly after showing home
    resume() {
      atHome = false;
    },
  };
}

// ---------- Access screen: the MFD's PowerShell-style prompt ----------
// Runs a short system check, types a PowerShell command and asks to confirm it, like
// PowerShell's own [Y]/[N] prompt (Enter on its own takes the default, Yes). Saying No drops
// to a crew shell with the same commands as the site's terminal, plus "open" to try again.
// On Yes the terminal dissolves into the site; BYPASS goes straight there. Pressing a key or
// clicking while it types skips ahead. Shown once per browser session; RESET on the site
// powers the screen down and runs it again.
function initBoot() {
  const root = document.documentElement;
  const frame = document.getElementById('mfd');
  const crt = document.getElementById('boot-crt');
  const log = document.getElementById('boot-log');
  const output = document.getElementById('boot-output');
  const form = document.getElementById('boot-form');
  const prompt = document.getElementById('boot-prompt');
  const input = document.getElementById('boot-input');
  const met = document.getElementById('boot-met');
  const planet = createAsciiPlanet(document.getElementById('boot-planet'), document.getElementById('boot-planet-caption'));
  let homeTimer = null;
  document.querySelector('.crt-planet').addEventListener('click', () => {
    clearTimeout(homeTimer);
    planet.spinHome(() => { homeTimer = setTimeout(() => planet.resume(), 5000); });
    achievements.unlock('globe');
  });

  // The page behind the screen, kept out of reach until access is granted
  const site = document.querySelectorAll('body > :not(#mfd):not(script)');

  const SHELL = 'PS C:\\CREW> ';
  const COMMAND = 'Open-CrewRecord -Name "Ashton Lee"';
  const CONFIRM = '[Y] Yes  [N] No  [?] Help (default is "Y"): ';

  // 'typing' while the screen runs by itself, 'confirm' at the Y/N prompt,
  // 'shell' at the crew shell prompt, 'done' once on the way to the site (or on the site)
  let mode = 'done';
  let fast = reducedMotion;   // skip the typing delays
  let run = 0;                // which run of the sequence is current, so an old one stops typing
  let loaded = 0;
  let metTimer = null;

  const waitingForInput = () => mode === 'confirm' || mode === 'shell';
  const wait = (ms) => (fast ? Promise.resolve() : new Promise((done) => setTimeout(done, ms)));

  // A status line with dot leaders, e.g. "DATA BUS 1-4 ......... NOMINAL"
  const status = (label, value) => label + ' ' + '.'.repeat(Math.max(3, 24 - label.length)) + ' ' + value;

  function line(text = '', className) {
    const p = document.createElement('p');
    if (className) p.className = className;
    p.textContent = text;
    output.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  function banner(text) {
    line();
    const highlight = document.createElement('span');
    highlight.textContent = text;
    line('', 'b-inverse').appendChild(highlight);
  }

  async function type(p, text, thisRun) {
    const start = p.textContent;
    for (let i = 0; i < text.length; i++) {
      if (thisRun !== run) return;
      if (fast) {
        p.textContent = start + text;
        return;
      }
      p.textContent += text[i];
      await wait(30 + Math.random() * 45);
    }
  }

  // The same commands as the site's terminal, plus "open"
  const commands = terminalCommands({
    print: (text) => line(text),
    append: (node) => {
      output.appendChild(node);
      log.scrollTop = log.scrollHeight;
    },
    clear: () => { output.innerHTML = ''; },
    extraHelp: '  open        open the crew record (enter the site)\n',
  });
  const remember = commandHistory(input);

  // Mission elapsed time since the sequence started, as DDD/HH:MM:SS
  const pad = (n, width = 2) => String(n).padStart(width, '0');
  function tickMet() {
    const s = Math.floor((Date.now() - loaded) / 1000);
    met.textContent = 'MET ' + pad(Math.floor(s / 86400), 3) + '/' + pad(Math.floor(s / 3600) % 24) + ':' +
      pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
  }

  // Start (or restart) the sequence on a blank screen
  function begin() {
    run++;
    mode = 'typing';
    fast = reducedMotion;
    output.innerHTML = '';
    form.hidden = true;
    frame.classList.remove('awaiting');
    site.forEach((el) => { el.inert = true; });
    loaded = Date.now();
    tickMet();
    clearInterval(metTimer);
    metTimer = setInterval(tickMet, 1000);
    planet.start();
    startUp(run);
  }

  // Restart the CSS flicker on the screen, as the tube settles after power-on
  function flicker() {
    crt.classList.remove('flicker');
    void crt.offsetWidth;   // reflow, so the animation plays again
    crt.classList.add('flicker');
  }

  // A loading bar that fills in uneven steps, with the odd stall, like real loading
  async function loadingBar(thisRun) {
    const CELLS = 24;
    const bar = line();
    let percent = 0;
    while (percent < 100) {
      if (thisRun !== run || mode === 'done') return;
      const filled = Math.round((percent / 100) * CELLS);
      bar.textContent = '[' + '█'.repeat(filled) + '░'.repeat(CELLS - filled) + '] ' + String(percent).padStart(3) + '%';
      await wait(Math.random() < 0.15 ? 220 : 40 + Math.random() * 50);
      percent = fast ? 100 : Math.min(100, percent + 2 + Math.floor(Math.random() * 7));
    }
    bar.textContent = '[' + '█'.repeat(CELLS) + '] 100%';
  }

  async function startUp(thisRun) {
    const current = () => thisRun === run && mode !== 'done';
    flicker();         // the tube flickers as it powers on...
    await wait(800);   // ...and settles before the text starts
    if (!current()) return;
    line('MEDS MFD 2 · BOOT ROM 4.07');
    line('LOADING FLIGHT SOFTWARE');
    await loadingBar(thisRun);
    if (!current()) return;
    line('FLIGHT SOFTWARE LOADED', 'b-dim');
    line();
    await wait(300);
    const checks = [
      ['GPC 1 SELF-TEST', 'PASS'],
      ['DATA BUS 1-4', 'NOMINAL'],
      ['S-BAND UPLINK', 'LOCKED'],
      ['CREW RECORDS', 'MOUNTED'],
    ];
    for (const [label, value] of checks) {
      if (!current()) return;
      line(status(label, value));
      await wait(260);
    }
    if (!current()) return;
    line();
    const command = line(SHELL);
    await wait(400);
    await type(command, COMMAND, thisRun);
    await wait(350);
    if (current()) askToConfirm();
  }

  function showPrompt(text, nextMode) {
    if (mode === 'done') return;
    mode = nextMode;
    prompt.textContent = text;
    form.hidden = false;
    input.value = '';
    frame.classList.add('awaiting');
    log.scrollTop = log.scrollHeight;
    input.focus({ preventScroll: true });
  }

  function askToConfirm() {
    if (mode === 'done') return;
    line();
    line('Confirm');
    line('Are you sure you want to perform this action?');
    line('Performing the operation "Open-CrewRecord" on target "LEE, ASHTON (Network Administrator)".');
    showPrompt(CONFIRM, 'confirm');
  }

  // Runs one of the shared commands; returns false if there's no such command
  function runShared(raw) {
    const [word, ...args] = raw.split(/\s+/);
    const name = word.toLowerCase();
    if (!commands[name]) return false;
    commands[name](args);
    return true;
  }

  async function submit(raw) {
    if (!waitingForInput()) return;
    const answeredAt = mode;
    mode = 'typing';
    frame.classList.remove('awaiting');
    form.hidden = true;

    const reply = raw.trim();
    line(prompt.textContent + reply);   // leave the prompt and answer on screen, as PowerShell does
    if (answeredAt === 'confirm') await confirmReply(reply);
    else shellCommand(reply);
  }

  async function confirmReply(reply) {
    const choice = reply.toLowerCase();
    const name = choice.split(/\s+/)[0];
    // "open" here means the same as Yes: the record is already the one being opened
    if (choice === '' || choice === 'y' || choice === 'yes' || name === 'open' || name === 'open-crewrecord') {
      await grant();
    } else if (choice === 'n' || choice === 'no') {
      line('Open-CrewRecord : The operation was canceled by the user.');
      line('Crew record remains locked. Type help to see commands, or open to try again.', 'b-dim');
      line();
      showPrompt(SHELL, 'shell');
    } else {
      // PowerShell's own help for "?"; crew commands also work here; anything else asks again
      if (choice === '?') {
        line('Y - Continue with only the next step of the operation.');
        line('N - Skip this operation and proceed with the next operation.');
      } else {
        runShared(reply);
      }
      showPrompt(CONFIRM, 'confirm');
    }
  }

  function shellCommand(raw) {
    if (raw) remember(raw);
    const name = raw.split(/\s+/)[0].toLowerCase();
    if (name === 'open' || name === 'open-crewrecord') {
      askToConfirm();
      return;
    }
    if (raw && !runShared(raw)) line('Command not found: ' + name + '. Type help for the list.', 'b-dim');
    showPrompt(SHELL, 'shell');
  }

  async function grant() {
    mode = 'done';
    try { sessionStorage.setItem('space-access', 'granted'); } catch (e) { /* storage blocked: ask again next visit */ }
    line();
    for (const label of ['VERIFYING CREDENTIALS', 'DECRYPTING RECORD']) {
      await wait(400);
      line(status(label, 'OK'));
    }
    await wait(400);
    banner('ACCESS GRANTED · WELCOME ABOARD');
    await wait(1000);
    enterSite();
  }

  // Straight to the site, whatever the screen is doing
  function bypass() {
    if (mode === 'done') return;
    mode = 'done';
    try { sessionStorage.setItem('space-access', 'granted'); } catch (e) { /* storage blocked: ask again next visit */ }
    form.hidden = true;
    frame.classList.remove('awaiting');
    banner('ACCESS BYPASSED');
    enterSite();
  }

  // Fade the terminal into the site and light up the labels (CSS .entering), then hand over.
  // The access screen stays in the page, hidden, for RESET.
  function enterSite() {
    clearInterval(metTimer);
    const finish = () => {
      planet.stop();
      root.classList.remove('booting');
      frame.classList.remove('entering', 'awaiting');
      site.forEach((el) => { el.inert = false; });
    };
    if (reducedMotion) {
      finish();
      return;
    }
    frame.classList.add('entering');
    setTimeout(finish, 1900);
  }

  // RESET on the site: the screen goes dark, then the CRT powers on and the sequence runs again
  function reset() {
    if (root.classList.contains('booting')) return;
    try { sessionStorage.removeItem('space-access'); } catch (e) { /* storage blocked: it always shows anyway */ }
    const goBack = () => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      root.classList.add('booting');
      frame.classList.remove('powering-off');
      begin();
    };
    if (reducedMotion) {
      goBack();
      return;
    }
    frame.classList.add('powering-off');
    setTimeout(goBack, 450);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(input.value);
  });

  // The labels along the bottom (their keys press them too). At the Y/N prompt they answer it;
  // at the crew shell YES opens the record, NO just gives a fresh prompt and HELP lists commands.
  const keyInput = {
    Y: { confirm: 'Y', shell: 'open' },
    N: { confirm: 'N', shell: '' },
    '?': { confirm: 'help', shell: 'help' },
  };
  frame.querySelectorAll('[data-answer]').forEach((label) => {
    label.addEventListener('click', (event) => {
      event.stopPropagation();
      if (waitingForInput()) submit(keyInput[label.dataset.answer][mode]);
      else fast = true;
    });
  });
  frame.querySelector('[data-boot="bypass"]').addEventListener('click', (event) => {
    event.stopPropagation();
    bypass();
  });

  // Clicking the display skips ahead, or puts the cursor back in the prompt
  frame.addEventListener('click', () => {
    if (!root.classList.contains('booting')) return;
    if (waitingForInput()) input.focus({ preventScroll: true });
    else fast = true;
  });

  // Any key skips ahead; once a prompt is up, typing goes to it even if it lost focus
  document.addEventListener('keydown', (event) => {
    if (!root.classList.contains('booting')) return;
    if (!waitingForInput()) fast = true;
    else if (document.activeElement !== input && !event.target.closest('button')) input.focus({ preventScroll: true });
  });

  if (root.classList.contains('booting')) begin();
  return { reset };
}

// ---------- Footer year ----------
function initYear() {
  document.getElementById('year').textContent = new Date().getFullYear();
}

// ---------- Start everything ----------
initFrame(initBoot());
initEasterEggs();
initHeroFraming();
initStarfield();
initClock();
initScrollReveal();
initTerminal();
initCopyEmail();
initYear();
