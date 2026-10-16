/* ==========================================================
   Ashton Lee — résumé, "mission control" edition: LUNAR DEFENSE
   A Galaga-style shooter drawn in phosphor vectors on the MFD screen.
   Loaded before main.js; the terminals' "play" command calls startArcade().
   High scores stay in this browser (localStorage).
   ========================================================== */

// ---------- High scores ----------
const ARCADE_SCORES_KEY = 'space-arcade-scores';

// Built-in entries so the table is never empty; visitors' own scores are saved alongside them
const ARCADE_SEED_SCORES = [
  { name: 'ASH', score: 30000, stage: 7 },
  { name: 'HST', score: 25000, stage: 6 },
  { name: 'ISS', score: 20000, stage: 5 },
  { name: 'APO', score: 15000, stage: 4 },
  { name: 'NAS', score: 12000, stage: 4 },
  { name: 'CUB', score: 10000, stage: 3 },
  { name: 'EGL', score: 8000, stage: 3 },
  { name: 'MFD', score: 6000, stage: 2 },
  { name: 'GPC', score: 4000, stage: 2 },
  { name: 'CRT', score: 2000, stage: 1 },
];

let unsavedScores = [];   // if the browser won't store them, scores still count for this visit

function loadSavedScores() {
  try { return JSON.parse(localStorage.getItem(ARCADE_SCORES_KEY)) || []; } catch (e) { return []; }
}

// The top ten of the built-in and saved scores, highest first
function arcadeTable() {
  return ARCADE_SEED_SCORES.concat(loadSavedScores(), unsavedScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function qualifies(score) {
  const table = arcadeTable();
  return score > 0 && (table.length < 10 || score > table[table.length - 1].score);
}

// Save a score; returns the entry so the table can highlight it
function saveScore(entry) {
  const saved = loadSavedScores();
  saved.push(entry);
  saved.sort((a, b) => b.score - a.score);
  try {
    localStorage.setItem(ARCADE_SCORES_KEY, JSON.stringify(saved.slice(0, 10)));
  } catch (e) {
    unsavedScores.push(entry);   // storage blocked: keep it for this visit
  }
  return entry;
}

// The table as text, for the "scores" command
function arcadeScoresText() {
  const lines = ['LUNAR DEFENSE · HIGH SCORES'];
  arcadeTable().forEach((entry, i) => {
    lines.push('  ' + String(i + 1).padStart(2) + '.  ' + entry.name.padEnd(3) + '  ' + String(entry.score).padStart(6, '0') + '  STAGE ' + entry.stage);
  });
  lines.push('Type play to take a shot at it.');
  return lines.join('\n');
}

// ---------- The game ----------
let arcadeRunning = null;   // the game in progress, if any

// Starts the game on the MFD screen. onExit runs when the player leaves it.
// Returns false if a game is already running.
function startArcade({ onExit } = {}) {
  if (arcadeRunning) return false;
  arcadeRunning = createArcade(() => {
    arcadeRunning = null;
    if (onExit) onExit();
  });
  return true;
}

function createArcade(onExit) {
  const root = document.documentElement;
  const frame = document.getElementById('mfd');
  const overlay = frame.querySelector('.mfd-game');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const labels = {};
  frame.querySelectorAll('.lbl.when-game').forEach((label) => { labels[label.dataset.key] = label.querySelector('.lbl-box'); });

  // The play field is 28 units wide (like the original's 28 tiles); its height follows the screen
  const FIELD_W = 28;
  const ROWS_Y = 4.4;        // where the formation starts
  const PLAYER_SPEED = 15;
  const SHOT_SPEED = 38;
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ .';
  const touchScreen = window.matchMedia('(pointer: coarse)').matches;

  // Screen layout, in CSS pixels; set by resize()
  let width = 0;
  let height = 0;
  let unit = 20;        // pixels per field unit
  let fieldX = 0;       // left edge of the play field
  let fieldH = 36;      // play field height in units
  let panels = false;   // room for the side panels?

  // Game state
  let state = 'title';  // title, playing, paused, gameover, initials, table
  let clock = 0;
  let score = 0;
  let lives = 3;
  let stage = 1;
  let extraShipGiven = false;
  let banner = '';
  let bannerTimer = 0;
  let waveClock = 0;
  let diveTimer = 0;
  let stateTimer = 0;
  let highlight = null;   // the new entry to blink in the table
  let table = arcadeTable();
  let colourAge = 0;
  let initials = null;    // { letters, index } while entering initials
  let player = null;
  let shots = [];
  let bullets = [];
  let enemies = [];
  let particles = [];
  let fireCooldown = 0;
  let phos = '#7dffa5';

  const input = { left: false, right: false, fire: false, target: null };

  const stars = Array.from({ length: 70 }, () => ({
    x: Math.random() * FIELD_W,
    y: Math.random() * 40,
    speed: 2 + Math.random() * 6,
    phase: Math.random() * Math.PI * 2,
  }));

  // ----- Shapes, in field units, drawn as glowing outlines -----
  // Enemies face down the screen (towards the player); the player's ship faces up.
  const mirror = (points) => points.concat(points.slice().reverse().map(([x, y]) => [-x, y]));
  const SHAPES = {
    player: [
      mirror([[0, -1.05], [0.22, -0.45], [0.32, -0.12], [0.92, 0.32], [0.92, 0.72], [0.36, 0.48], [0.22, 0.78]]),
      [[0, -0.6], [0, 0.4]],
    ],
    bee: [
      [[0, 0.6], [0.3, 0], [0, -0.55], [-0.3, 0]],
      [[0.3, -0.05], [0.88, -0.48], [0.88, 0.22], [0.3, 0.18]],
      [[-0.3, -0.05], [-0.88, -0.48], [-0.88, 0.22], [-0.3, 0.18]],
    ],
    beeFlap: [
      [[0, 0.6], [0.3, 0], [0, -0.55], [-0.3, 0]],
      [[0.3, 0], [0.88, -0.12], [0.8, 0.52], [0.3, 0.2]],
      [[-0.3, 0], [-0.88, -0.12], [-0.8, 0.52], [-0.3, 0.2]],
    ],
    butterfly: [
      [[0, 0.65], [0, -0.5]],
      [[0.12, -0.25], [0.92, -0.72], [0.98, 0.24], [0.12, 0.3]],
      [[-0.12, -0.25], [-0.92, -0.72], [-0.98, 0.24], [-0.12, 0.3]],
      [[0.08, 0.6], [0.32, 0.95]],
      [[-0.08, 0.6], [-0.32, 0.95]],
    ],
    butterflyFlap: [
      [[0, 0.65], [0, -0.5]],
      [[0.12, -0.15], [0.98, -0.3], [0.86, 0.6], [0.12, 0.32]],
      [[-0.12, -0.15], [-0.98, -0.3], [-0.86, 0.6], [-0.12, 0.32]],
      [[0.08, 0.6], [0.32, 0.95]],
      [[-0.08, 0.6], [-0.32, 0.95]],
    ],
    boss: [
      [[0, 0.75], [0.45, 0.38], [0.45, -0.35], [0, -0.68], [-0.45, -0.35], [-0.45, 0.38]],
      [[0.45, -0.2], [1.05, -0.62], [1.1, 0.42], [0.45, 0.28]],
      [[-0.45, -0.2], [-1.05, -0.62], [-1.1, 0.42], [-0.45, 0.28]],
      [[-0.2, 0.15], [-0.08, 0.32]],
      [[0.2, 0.15], [0.08, 0.32]],
    ],
  };
  const CLOSED = { player: [true, false], bee: [true, true, true], beeFlap: [true, true, true], butterfly: [false, true, true, false, false], butterflyFlap: [false, true, true, false, false], boss: [true, true, true, false, false] };
  const POINTS = { bee: [50, 100], butterfly: [80, 160], boss: [150, 400] };

  // ----- Layout and colour -----
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = overlay.clientWidth;
    height = overlay.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // A portrait play field (about 3:4), centred; on wide screens the margins hold panels
    const fieldW = Math.min(width, height * 0.8);
    unit = fieldW / FIELD_W;
    fieldX = (width - fieldW) / 2;
    fieldH = height / unit;
    panels = fieldX >= 170;
    if (player) player.y = fieldH - 3.4;
  }

  function readColour() {
    phos = getComputedStyle(root).getPropertyValue('--phos').trim() || '#7dffa5';
  }

  // ----- Drawing helpers -----
  // A glowing line: a wide faint stroke, then a thin bright one
  function stroke(path, closed, alpha = 1) {
    for (const [lineWidth, a] of [[0.32, 0.22 * alpha], [0.09, alpha]]) {
      ctx.globalAlpha = a;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (closed) ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawShape(name, x, y, angle = 0, scale = 1, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    SHAPES[name].forEach((path, i) => stroke(path, CLOSED[name][i], alpha));
    ctx.restore();
  }

  // Text in screen pixels, with a soft glow
  function text(str, x, y, size, align = 'center', alpha = 1) {
    ctx.save();
    ctx.setTransform(ctx.getTransform().a, 0, 0, ctx.getTransform().d, 0, 0);
    ctx.font = '700 ' + size + 'px "B612 Mono", "JetBrains Mono", monospace';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = phos;
    ctx.shadowColor = phos;
    ctx.shadowBlur = size * 0.5;
    ctx.globalAlpha = alpha;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // Field units to screen pixels
  const sx = (x) => fieldX + x * unit;
  const sy = (y) => y * unit;
  const blink = (rate = 2) => Math.floor(clock * rate) % 2 === 0;
  const pad = (n, w = 6) => String(n).padStart(w, '0');
  const best = () => Math.max(score, table[0].score);

  // ----- Game setup -----
  function newGame() {
    score = 0;
    lives = 3;
    stage = 1;
    extraShipGiven = false;
    bullets = [];
    shots = [];
    particles = [];
    player = { x: FIELD_W / 2, y: fieldH - 3.4, alive: true, respawn: 0, safe: 2 };
    state = 'playing';
    startWave();
  }

  const speedScale = () => 1 + (stage - 1) * 0.12;

  // Where an enemy's place in the formation is right now (the formation sways side to side)
  function slot(e) {
    const sway = Math.sin(clock * 0.9) * 1.3;
    return { x: FIELD_W / 2 + (e.col - 4.5) * 2.1 + sway, y: ROWS_Y + e.row * 1.9 };
  }

  // 4 bosses, 16 butterflies and 20 bees, flying in as five groups of eight
  function startWave() {
    const groups = [
      [[3, 3], [3, 4], [3, 5], [3, 6], [1, 3], [1, 4], [1, 5], [1, 6]],
      [[0, 3], [0, 4], [0, 5], [0, 6], [1, 1], [1, 2], [1, 7], [1, 8]],
      [[2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8]],
      [[3, 0], [3, 1], [3, 2], [3, 7], [3, 8], [3, 9], [4, 4], [4, 5]],
      [[4, 0], [4, 1], [4, 2], [4, 3], [4, 6], [4, 7], [4, 8], [4, 9]],
    ];
    const typeFor = (row) => (row === 0 ? 'boss' : row <= 2 ? 'butterfly' : 'bee');
    enemies = [];
    groups.forEach((members, g) => {
      const side = g % 2 === 0 ? -1 : 1;
      members.forEach(([row, col], i) => {
        const type = typeFor(row);
        enemies.push({
          type, row, col, side,
          hp: type === 'boss' ? 2 : 1,
          state: 'waiting',
          start: g * 1.7 + i * 0.13,
          t: 0, x: -5, y: -5, vx: 0, vy: 0, angle: 0, shotsLeft: 0, fireAt: 0,
        });
      });
    });
    banner = 'STAGE ' + stage;
    bannerTimer = 2;
    waveClock = -2;   // the first group comes in as the banner clears
    diveTimer = 3;
  }

  // ----- Updating -----
  function addScore(points, x, y) {
    score += points;
    if (!extraShipGiven && score >= 20000) {
      extraShipGiven = true;
      lives++;
      banner = 'EXTRA SHIP';
      bannerTimer = 1.6;
    }
    if (points >= 160) particles.push({ text: String(points), x, y, life: 1 });
  }

  function explode(x, y, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 4 + Math.random() * 9;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4 });
    }
  }

  // Cubic Bézier, for the curves enemies fly in along
  function bezier(p0, p1, p2, p3, s) {
    const u = 1 - s;
    return {
      x: u * u * u * p0.x + 3 * u * u * s * p1.x + 3 * u * s * s * p2.x + s * s * s * p3.x,
      y: u * u * u * p0.y + 3 * u * u * s * p1.y + 3 * u * s * s * p2.y + s * s * s * p3.y,
    };
  }

  function moveTo(e, target, speed, dt) {
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(dist, speed * dt);
    if (dist > 0.001) {
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
      e.angle = Math.atan2(dy, dx) - Math.PI / 2;
    }
    return dist - step;
  }

  function updateEnemies(dt) {
    const speed = speedScale();
    waveClock += dt;
    for (const e of enemies) {
      e.t += dt * speed;
      const home = slot(e);
      if (e.state === 'waiting') {
        if (waveClock >= e.start) {
          e.state = 'enter';
          e.t = 0;
        }
      } else if (e.state === 'enter') {
        // Swoop in from a top corner, loop across the screen, then head for its place
        const s = Math.min(1, e.t / 1.5);
        const c = FIELD_W / 2;
        const p = bezier(
          { x: c + e.side * 16, y: -2 },
          { x: c + e.side * 5, y: fieldH * 0.45 },
          { x: c - e.side * 9, y: fieldH * 0.62 },
          { x: c - e.side * 2, y: fieldH * 0.3 },
          s
        );
        e.angle = Math.atan2(p.y - e.y, p.x - e.x) - Math.PI / 2;
        e.x = p.x;
        e.y = p.y;
        if (s >= 1) e.state = 'join';
      } else if (e.state === 'join' || e.state === 'return') {
        if (moveTo(e, home, 13 * speed, dt) < 0.2) {
          e.state = 'formation';
          e.angle = 0;
        }
      } else if (e.state === 'formation') {
        e.x = home.x;
        e.y = home.y;
        e.angle *= 0.8;
      } else if (e.state === 'dive') {
        // Rise and arc out, then fall towards the player, steering and weaving, firing on the way
        e.vy = Math.min(e.vy + 24 * speed * dt, 15 * speed);
        const aim = player && player.alive ? player.x : FIELD_W / 2;
        e.vx += ((aim - e.x) * 1.6 - e.vx) * dt * 1.5;
        e.x += (e.vx + Math.sin(e.t * 4) * 3) * dt;
        e.y += e.vy * dt;
        e.angle = Math.atan2(e.vy, e.vx) - Math.PI / 2;
        if (e.shotsLeft > 0 && e.y > e.fireAt && player && player.alive) {
          e.shotsLeft--;
          e.fireAt += 3 + Math.random() * 3;
          const bulletSpeed = 13 + stage * 1.4;
          const dx = player.x - e.x;
          const dy = Math.max(4, player.y - e.y);
          const len = Math.hypot(dx, dy);
          bullets.push({ x: e.x, y: e.y + 0.6, vx: Math.max(-6, Math.min(6, (dx / len) * bulletSpeed)), vy: (dy / len) * bulletSpeed });
        }
        if (e.y > fieldH + 2) {
          // Off the bottom: come back in from the top and rejoin the formation
          e.y = -2;
          e.x = home.x;
          e.state = 'return';
        }
      }
    }

    // Send a few into a dive, once everyone has flown in
    const settled = enemies.every((e) => e.state !== 'waiting' && e.state !== 'enter');
    diveTimer -= dt;
    if (settled && diveTimer <= 0 && player && player.alive) {
      const divers = enemies.filter((e) => e.state === 'dive').length;
      const maxDivers = Math.min(2 + stage, 6);
      const ready = enemies.filter((e) => e.state === 'formation');
      let count = Math.min(1 + Math.floor(Math.random() * Math.min(3, 1 + stage / 2)), maxDivers - divers, ready.length);
      while (count-- > 0) {
        const e = ready.splice(Math.floor(Math.random() * ready.length), 1)[0];
        e.state = 'dive';
        e.t = 0;
        e.vx = (e.x < FIELD_W / 2 ? -1 : 1) * 7;
        e.vy = -9;
        e.shotsLeft = 1 + (Math.random() < 0.3 + stage * 0.08 ? 1 : 0);
        e.fireAt = fieldH * (0.3 + Math.random() * 0.2);
      }
      diveTimer = Math.max(0.9, 3.2 - (stage - 1) * 0.35) * (0.7 + Math.random() * 0.6);
    }
  }

  function updatePlayer(dt) {
    if (player.alive) {
      if (input.target !== null) {
        const gap = input.target - player.x;
        player.x += Math.sign(gap) * Math.min(Math.abs(gap), PLAYER_SPEED * dt);
      } else {
        player.x += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * PLAYER_SPEED * dt;
      }
      player.x = Math.max(1, Math.min(FIELD_W - 1, player.x));
      player.safe = Math.max(0, player.safe - dt);
      fireCooldown -= dt;
      // Two shots on screen at most, as in the original
      if (input.fire && fireCooldown <= 0 && shots.length < 2) {
        shots.push({ x: player.x, y: player.y - 1 });
        fireCooldown = 0.22;
      }
    } else if (lives > 0) {
      player.respawn -= dt;
      const diving = enemies.some((e) => e.state === 'dive');
      if (player.respawn <= 0 && (!diving || player.respawn < -3)) {
        player.alive = true;
        player.safe = 2;
        player.x = FIELD_W / 2;
      }
    }
  }

  function hitPlayer() {
    if (!player.alive || player.safe > 0) return;
    player.alive = false;
    player.respawn = 2;
    lives--;
    explode(player.x, player.y, 26);
    if (lives <= 0) {
      stateTimer = 3;
      state = 'gameover';
    }
  }

  function updatePlay(dt) {
    if (bannerTimer > 0) bannerTimer -= dt;
    updateEnemies(dt);
    updatePlayer(dt);

    shots = shots.filter((s) => (s.y -= SHOT_SPEED * dt) > -1);
    bullets = bullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      return b.y < fieldH + 1;
    });

    // Shots hitting enemies
    for (const s of shots) {
      for (const e of enemies) {
        if (e.state === 'waiting' || s.hit) continue;
        if (Math.abs(s.x - e.x) < 0.95 && Math.abs(s.y - e.y) < 0.85) {
          s.hit = true;
          e.hp--;
          if (e.hp <= 0) {
            e.dead = true;
            explode(e.x, e.y);
            addScore(POINTS[e.type][e.state === 'formation' ? 0 : 1], e.x, e.y);
          }
        }
      }
    }
    shots = shots.filter((s) => !s.hit);
    enemies = enemies.filter((e) => !e.dead);

    // Enemy bullets and divers hitting the player
    if (player.alive) {
      for (const b of bullets) {
        if (Math.abs(b.x - player.x) < 0.7 && Math.abs(b.y - player.y) < 0.8) {
          b.hit = true;
          hitPlayer();
        }
      }
      bullets = bullets.filter((b) => !b.hit);
      for (const e of enemies) {
        if (e.state !== 'formation' && Math.hypot(e.x - player.x, e.y - player.y) < 1.3 && player.safe <= 0) {
          e.dead = true;
          explode(e.x, e.y);
          addScore(POINTS[e.type][1], e.x, e.y);
          hitPlayer();
        }
      }
      enemies = enemies.filter((e) => !e.dead);
    }

    // Wave cleared: on to the next stage
    if (enemies.length === 0 && state === 'playing') {
      stage++;
      startWave();
    }
  }

  function update(dt) {
    clock += dt;
    colourAge += dt;
    if (colourAge > 0.4) {
      colourAge = 0;
      readColour();
    }
    for (const star of stars) {
      star.y += star.speed * dt * (state === 'paused' ? 0 : 1);
      if (star.y > fieldH) {
        star.y = 0;
        star.x = Math.random() * FIELD_W;
      }
    }
    particles = particles.filter((p) => {
      p.life -= dt;
      if (p.vx !== undefined) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else {
        p.y -= dt * 2;
      }
      return p.life > 0;
    });

    if (state === 'playing') {
      updatePlay(dt);
    } else if (state === 'gameover') {
      updateEnemies(dt);
      stateTimer -= dt;
      if (stateTimer <= 0) {
        if (qualifies(score)) {
          initials = { letters: ['A', 'A', 'A'], index: 0 };
          state = 'initials';
        } else {
          highlight = null;
          state = 'table';
          stateTimer = 8;
        }
      }
    } else if (state === 'table') {
      stateTimer -= dt;
      if (stateTimer <= 0) state = 'title';
    }
    setLabels();
  }

  // ----- Rendering -----
  function render() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(fieldX, 0);
    ctx.scale(unit, unit);
    ctx.strokeStyle = phos;
    ctx.fillStyle = phos;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Stars
    for (const star of stars) {
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(clock * 3 + star.phase));
      ctx.fillRect(star.x, star.y, 0.09, 0.09);
    }
    ctx.globalAlpha = 1;

    if (state === 'playing' || state === 'paused' || state === 'gameover') {
      drawPlay();
    }
    ctx.restore();

    drawHud();
    if (state === 'title') drawTitle();
    if (state === 'paused') drawPaused();
    if (state === 'gameover') text('GAME OVER', sx(FIELD_W / 2), sy(fieldH * 0.45), unit * 1.4);
    if (state === 'initials') drawInitials();
    if (state === 'table') drawTable(sx(FIELD_W / 2), sy(fieldH * 0.18), unit * 0.95, true);
    if (panels) drawPanels();
  }

  function drawPlay() {
    const flap = Math.floor(clock * 3) % 2 === 1;
    for (const e of enemies) {
      if (e.state === 'waiting') continue;
      const name = e.type === 'boss' ? 'boss' : e.type + (flap ? 'Flap' : '');
      drawShape(name, e.x, e.y, e.angle, 1, e.type === 'boss' && e.hp === 1 ? 0.55 : 1);
    }
    if (player && player.alive && (player.safe <= 0 || blink(8))) drawShape('player', player.x, player.y);
    for (const s of shots) stroke([[s.x, s.y - 0.45], [s.x, s.y + 0.45]], false);
    for (const b of bullets) stroke([[b.x, b.y - 0.3], [b.x, b.y + 0.3]], false, 0.85);
    for (const p of particles) {
      if (p.text) continue;
      stroke([[p.x, p.y], [p.x - p.vx * 0.04, p.y - p.vy * 0.04]], false, Math.min(1, p.life * 2));
    }
  }

  function drawHud() {
    const size = Math.max(10, unit * 0.75);
    text('1UP', sx(3), sy(1), size, 'center', blink(2) ? 1 : 0.35);
    text(pad(score), sx(3), sy(2.1), size);
    text('HIGH SCORE', sx(FIELD_W / 2), sy(1), size);
    text(pad(best()), sx(FIELD_W / 2), sy(2.1), size);
    if (state === 'playing' || state === 'paused' || state === 'gameover') {
      // Spare ships along the bottom left, the stage at the bottom right
      ctx.save();
      ctx.translate(fieldX, 0);
      ctx.scale(unit, unit);
      ctx.strokeStyle = phos;
      for (let i = 0; i < Math.min(lives - (player && player.alive ? 1 : 0), 6); i++) {
        drawShape('player', 1.4 + i * 1.6, fieldH - 0.9, 0, 0.6, 0.8);
      }
      ctx.restore();
      text('STAGE ' + stage, sx(FIELD_W - 1), sy(fieldH - 0.9), size * 0.85, 'right', 0.8);
      if (bannerTimer > 0) text(banner, sx(FIELD_W / 2), sy(fieldH * 0.55), unit * 1.1);
      for (const p of particles) {
        if (p.text) text(p.text, sx(p.x), sy(p.y), size * 0.8, 'center', Math.min(1, p.life * 2));
      }
    }
  }

  function drawTitle() {
    const cx = sx(FIELD_W / 2);
    text('LUNAR', cx, sy(fieldH * 0.17), unit * 2.2);
    text('DEFENSE', cx, sy(fieldH * 0.17) + unit * 2.4, unit * 2.2);
    // The cast and their points, like an arcade attract screen
    ctx.save();
    ctx.translate(fieldX, 0);
    ctx.scale(unit, unit);
    ctx.strokeStyle = phos;
    const rowY = (i) => fieldH * 0.42 + i * 2.4;
    drawShape('boss', 9, rowY(0));
    drawShape('butterfly', 9, rowY(1));
    drawShape('bee', 9, rowY(2));
    ctx.restore();
    const size = Math.max(10, unit * 0.8);
    text('150 / 400 PTS', sx(11), sy(fieldH * 0.42), size, 'left', 0.85);
    text(' 80 / 160 PTS', sx(11), sy(fieldH * 0.42 + 2.4), size, 'left', 0.85);
    text(' 50 / 100 PTS', sx(11), sy(fieldH * 0.42 + 4.8), size, 'left', 0.85);
    text('FORMATION / DIVING', sx(11), sy(fieldH * 0.42 + 6.6), size * 0.75, 'left', 0.5);
    if (blink(1.5)) text(touchScreen ? 'PRESS START' : 'PRESS FIRE TO START', cx, sy(fieldH * 0.78), unit * 0.95);
    const hint = touchScreen ? 'DRAG OR ◄ ► TO MOVE · FIRE TO SHOOT' : '← → MOVE · SPACE FIRE · P PAUSE · ESC EXIT';
    text(hint, cx, sy(fieldH * 0.86), Math.max(9, unit * 0.6), 'center', 0.6);
    text('TOP SCORE  ' + table[0].name + '  ' + pad(table[0].score), cx, sy(fieldH * 0.93), Math.max(9, unit * 0.65), 'center', 0.75);
  }

  function drawPaused() {
    text('PAUSED', sx(FIELD_W / 2), sy(fieldH * 0.42), unit * 1.4);
    const hint = touchScreen ? 'RESUME TO CONTINUE · EXIT TO QUIT' : 'P TO CONTINUE · ESC TO QUIT';
    text(hint, sx(FIELD_W / 2), sy(fieldH * 0.42) + unit * 2, Math.max(10, unit * 0.65), 'center', 0.8);
  }

  function drawInitials() {
    const cx = sx(FIELD_W / 2);
    text('NEW HIGH SCORE', cx, sy(fieldH * 0.25), unit * 1.1);
    text(pad(score), cx, sy(fieldH * 0.25) + unit * 1.8, unit * 1.1);
    text('ENTER YOUR INITIALS', cx, sy(fieldH * 0.42), Math.max(10, unit * 0.8), 'center', 0.85);
    const size = unit * 2.4;
    initials.letters.forEach((letter, i) => {
      const x = cx + (i - 1) * size * 1.1;
      const y = sy(fieldH * 0.52);
      const current = i === initials.index;
      text(letter === ' ' ? '_' : letter, x, y, size, 'center', current && !blink(4) ? 0.25 : current ? 1 : 0.85);
    });
    const hint = touchScreen ? '◄ ► CHOOSE · FIRE OK' : '← → OR TYPE · SPACE / ENTER OK';
    text(hint, cx, sy(fieldH * 0.66), Math.max(9, unit * 0.65), 'center', 0.65);
  }

  // The top ten; wide: with stage numbers
  function drawTable(cx, top, size, wide) {
    text('HIGH SCORES', cx, top, size * 1.1);
    let marked = false;
    table.forEach((entry, i) => {
      // The table is rebuilt from storage, so find the new entry by its values (first match)
      const isNew = !marked && highlight !== null && entry.name === highlight.name && entry.score === highlight.score && entry.stage === highlight.stage;
      if (isNew) marked = true;
      const line = String(i + 1).padStart(2) + '  ' + entry.name.padEnd(3) + '  ' + pad(entry.score) + (wide ? '  ST ' + entry.stage : '');
      text(line, cx, top + size * (2 + i * 1.5), size, 'center', isNew ? (blink(4) ? 1 : 0.2) : 0.85);
    });
    if (wide && state === 'table' && blink(1.5)) text(touchScreen ? 'PRESS START' : 'PRESS FIRE', cx, top + size * 19, size);
  }

  // On wide screens: the high scores to the left of the field, controls to the right
  function drawPanels() {
    const size = 12;
    drawTable(fieldX / 2, height * 0.16, size, false);
    const cx = width - fieldX / 2;
    const lines = touchScreen
      ? ['CONTROLS', '', 'DRAG · MOVE', '◄ ► · MOVE', 'FIRE · SHOOT', 'PAUSE · PAUSE']
      : ['CONTROLS', '', '← →  MOVE', 'SPACE  FIRE', 'P  PAUSE', 'ESC  EXIT', '', 'OR USE THE', 'KEYS BELOW'];
    lines.forEach((line, i) => text(line, cx, height * 0.16 + i * size * 1.8, i === 0 ? size * 1.1 : size, 'center', i === 0 ? 1 : 0.75));
  }

  // ----- The MFD's bottom labels show what each key does on this screen -----
  const LABELS = {
    title: ['◄', '►', 'EXIT', 'START', 'START'],
    playing: ['◄', '►', 'PAUSE', 'FIRE', 'FIRE'],
    paused: ['', '', 'RESUME', '', 'EXIT'],
    gameover: ['', '', '', '', ''],
    initials: ['◄', '►', '', 'OK', 'OK'],
    table: ['', '', 'EXIT', 'OK', 'OK'],
  };
  let labelState = null;
  function setLabels() {
    if (labelState === state) return;
    labelState = state;
    LABELS[state].forEach((label, i) => {
      const box = labels['b' + (i + 1)];
      if (box) box.textContent = label;
    });
  }

  // ----- Input -----
  // One place for keys, MFD keys and labels: "press" and "release" a control
  function press(control) {
    if (control === 'left') {
      input.left = true;
      input.target = null;
      if (state === 'initials') cycleLetter(-1);
    } else if (control === 'right') {
      input.right = true;
      input.target = null;
      if (state === 'initials') cycleLetter(1);
    } else if (control === 'fire') {
      input.fire = true;
      if (state === 'title' || state === 'table') newGame();
      else if (state === 'initials') confirmLetter();
    } else if (control === 'pause') {
      if (state === 'playing') state = 'paused';
      else if (state === 'paused') state = 'playing';
    } else if (control === 'exit') {
      exit();
    }
  }

  function release(control) {
    if (control === 'left') input.left = false;
    if (control === 'right') input.right = false;
    if (control === 'fire') input.fire = false;
  }

  function cycleLetter(step) {
    const letters = initials.letters;
    const i = CHARS.indexOf(letters[initials.index]);
    letters[initials.index] = CHARS[(i + step + CHARS.length) % CHARS.length];
  }

  function confirmLetter() {
    initials.index++;
    if (initials.index < 3) return;
    highlight = saveScore({ name: initials.letters.join(''), score, stage });
    table = arcadeTable();
    initials = null;
    state = 'table';
    stateTimer = 10;
  }

  // What each MFD key does on the current screen
  function keyControl(key) {
    const map = {
      b1: 'left',
      b2: 'right',
      b3: state === 'playing' || state === 'paused' ? 'pause' : state === 'title' || state === 'table' ? 'exit' : null,
      b4: state === 'paused' ? null : 'fire',
      b5: state === 'paused' ? 'exit' : 'fire',
    };
    return map[key];
  }

  const KEYS = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ' ': 'fire', ArrowUp: 'fire', Enter: 'fire', w: 'fire', W: 'fire', z: 'fire', Z: 'fire',
    p: 'pause', P: 'pause',
    Escape: 'exit',
  };

  // Keys are caught before anything else on the page sees them (the terminals, the Konami code)
  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    let control = KEYS[event.key];
    let handled = Boolean(control);
    if (state === 'initials') {
      handled = true;
      if (event.key === 'ArrowUp') control = 'right';
      if (event.key === 'ArrowDown') control = 'left';
      if (/^[a-z.]$/i.test(event.key)) {
        initials.letters[initials.index] = event.key.toUpperCase();
        confirmLetter();
        control = null;
      } else if (event.key === 'Backspace') {
        initials.index = Math.max(0, initials.index - 1);
        control = null;
      } else if (!control) {
        handled = false;
      }
    }
    // Nothing else on the page sees keys while the game is up; only the game's own keys
    // are kept from the browser (so shortcuts like F5 still work)
    event.stopPropagation();
    if (!handled) return;
    event.preventDefault();
    if (control && !event.repeat) press(control);
  }

  function onKeyUp(event) {
    const control = KEYS[event.key];
    if (control) release(control);
    event.stopPropagation();
  }

  // Holding an MFD key (or its label) keeps it pressed
  const held = new Map();
  function onKeyPointerDown(event) {
    const key = event.currentTarget.dataset.key;
    const control = keyControl(key);
    event.preventDefault();
    if (!control) return;
    held.set(event.pointerId, control);
    press(control);
  }

  function onKeyPointerUp(event) {
    const control = held.get(event.pointerId);
    if (control) release(control);
    held.delete(event.pointerId);
  }

  // Dragging on the screen steers the ship to the finger and fires
  function fieldXAt(event) {
    const rect = canvas.getBoundingClientRect();
    return (event.clientX - rect.left - fieldX) / unit;
  }

  function onCanvasDown(event) {
    event.preventDefault();
    try { canvas.setPointerCapture(event.pointerId); } catch (e) { /* not capturable: dragging still works over the canvas */ }
    if (state === 'title' || state === 'table') {
      newGame();
      return;
    }
    if (state !== 'playing') return;
    input.target = fieldXAt(event);
    input.fire = true;
  }

  function onCanvasMove(event) {
    if (input.target !== null) input.target = fieldXAt(event);
  }

  function onCanvasUp() {
    input.target = null;
    input.fire = false;
  }

  function onVisibility() {
    if (document.hidden && state === 'playing') state = 'paused';
  }

  const controls = frame.querySelectorAll('.mfd-labels-bottom .when-game, .osb-bottom .osb');
  const blockMenu = (event) => event.preventDefault();

  // ----- Start and stop -----
  let running = true;
  let last = performance.now();
  let raf = 0;

  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(loop);
  }

  function exit() {
    running = false;
    cancelAnimationFrame(raf);
    observer.disconnect();
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    document.removeEventListener('visibilitychange', onVisibility);
    controls.forEach((control) => {
      control.removeEventListener('pointerdown', onKeyPointerDown);
      control.removeEventListener('pointerup', onKeyPointerUp);
      control.removeEventListener('pointercancel', onKeyPointerUp);
      control.removeEventListener('pointerleave', onKeyPointerUp);
    });
    canvas.removeEventListener('pointerdown', onCanvasDown);
    canvas.removeEventListener('pointermove', onCanvasMove);
    canvas.removeEventListener('pointerup', onCanvasUp);
    canvas.removeEventListener('pointercancel', onCanvasUp);
    frame.removeEventListener('contextmenu', blockMenu);
    frame.classList.remove('gaming');
    root.classList.remove('gaming');
    onExit();
  }

  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  frame.classList.add('gaming');
  root.classList.add('gaming');
  readColour();
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(overlay);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('visibilitychange', onVisibility);
  controls.forEach((control) => {
    control.addEventListener('pointerdown', onKeyPointerDown);
    control.addEventListener('pointerup', onKeyPointerUp);
    control.addEventListener('pointercancel', onKeyPointerUp);
    control.addEventListener('pointerleave', onKeyPointerUp);
  });
  canvas.addEventListener('pointerdown', onCanvasDown);
  canvas.addEventListener('pointermove', onCanvasMove);
  canvas.addEventListener('pointerup', onCanvasUp);
  canvas.addEventListener('pointercancel', onCanvasUp);
  frame.addEventListener('contextmenu', blockMenu);
  setLabels();
  raf = requestAnimationFrame(loop);

  // For checking the game in tests: a peek at (and a way to end) the current game
  return {
    get state() { return state; },
    get score() { return score; },
    endGame() {
      if (state !== 'playing') return;
      lives = 1;
      if (player) player.safe = 0;
      hitPlayer();
    },
    setScore(value) { score = value; },
  };
}
