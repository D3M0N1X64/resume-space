/* ==========================================================
   Ashton Lee — résumé, "mission control" edition: easter eggs
   Loaded before main.js, which adds hiddenCommands() to both terminals
   and calls initEasterEggs() once the page is set up.
   ========================================================== */

// ---------- Achievements ----------
// Each easter egg unlocks one. Found ones are remembered in this browser (localStorage).
const ACHIEVEMENTS = [
  { id: 'daylight', name: 'Here comes the sun', hint: 'Switch the display to DAY and watch the horizon.' },
  { id: 'ping', name: 'Echo reply', hint: 'A network admin\'s first troubleshooting command.' },
  { id: 'tracert', name: 'Hop by hop', hint: 'Trace the route to someone\'s inbox.' },
  { id: 'nslookup', name: 'Name resolved', hint: 'Ask DNS who Ashton is.' },
  { id: 'globe', name: 'Home base', hint: 'Ask for the globe, or click the one on the access screen.' },
  { id: 'hubble', name: 'Target acquired', hint: 'Something is drifting across the sky. Click it.' },
  { id: 'tune', name: 'Knob twiddler', hint: 'The switches in the bezel corners work. (Wide screens)' },
  { id: 'power', name: 'Off and on again', hint: 'The oldest fix in IT. Find the power lamp. (Wide screens)' },
  { id: 'selftest', name: 'Self-test passed', hint: 'A blank key near a top corner, pressed three times. (Wide screens)' },
  { id: 'caution', name: 'Master caution', hint: 'A blank key near a bottom corner. (Wide screens)' },
  { id: 'konami', name: 'Old school', hint: 'Up, up, down, down, left, right, left, right, B, A.' },
  { id: 'devtools', name: 'Under the hood', hint: 'Developers have a console of their own.' },
];

const achievements = (() => {
  const KEY = 'space-achievements';
  let found = [];
  try { found = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { /* storage blocked: start fresh */ }

  function unlock(id) {
    if (found.includes(id)) return;
    const entry = ACHIEVEMENTS.find((a) => a.id === id);
    if (!entry) return;
    found.push(id);
    try { localStorage.setItem(KEY, JSON.stringify(found)); } catch (e) { /* storage blocked: just this visit */ }
    showToast('ACHIEVEMENT · ' + entry.name.toUpperCase() + ' (' + found.length + '/' + ACHIEVEMENTS.length + ')');
    if (found.length === ACHIEVEMENTS.length) showToast('ALL ' + ACHIEVEMENTS.length + ' FOUND · YOU\'D MAKE A GREAT SYSADMIN');
  }

  // The list as text, for the "achievements" command and the developer console
  function report() {
    const lines = ['Achievements: ' + found.length + ' / ' + ACHIEVEMENTS.length];
    for (const a of ACHIEVEMENTS) {
      lines.push(found.includes(a.id) ? '  [x] ' + a.name : '  [ ] ???  hint: ' + a.hint);
    }
    if (found.length === ACHIEVEMENTS.length) lines.push('All found. Say hi: ashton.redsky@gmail.com');
    return lines.join('\n');
  }

  return { unlock, report };
})();

// ---------- Toasts on the MFD screen ----------
// Short messages near the top of the screen, one after another. A 'setting' readout (like
// "BRT 85%") updates in place instead of queuing, so pressing a rocker repeatedly doesn't
// stack up a line of messages.
const toastQueue = [];
let toastCurrent = null;   // the message showing now, if any
let toastTimer = null;

function showToast(text, kind = 'message') {
  if (kind === 'setting') {
    if (toastCurrent && toastCurrent.kind === 'setting') {
      toastCurrent.text = text;
      document.getElementById('mfd-toast').textContent = text;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(hideToast, 1600);
      return;
    }
    const queued = toastQueue.find((item) => item.kind === 'setting');
    if (queued) {
      queued.text = text;
      return;
    }
  }
  toastQueue.push({ text, kind });
  if (!toastCurrent) nextToast();
}

function nextToast() {
  const toast = document.getElementById('mfd-toast');
  toastCurrent = toastQueue.shift() || null;
  if (!toast || !toastCurrent) return;
  toast.textContent = toastCurrent.text;
  toast.classList.add('show');
  toastTimer = setTimeout(hideToast, { setting: 1600, hint: 6000 }[toastCurrent.kind] || 2600);
}

function hideToast() {
  document.getElementById('mfd-toast').classList.remove('show');
  setTimeout(nextToast, 300);
}

// Take down a message of one kind (e.g. the access screen's skip hint), shown or queued
function dismissToast(kind) {
  for (let i = toastQueue.length - 1; i >= 0; i--) {
    if (toastQueue[i].kind === kind) toastQueue.splice(i, 1);
  }
  if (toastCurrent && toastCurrent.kind === kind) {
    clearTimeout(toastTimer);
    hideToast();
  }
}

// ---------- Hidden terminal commands ----------
// Not listed in "help"; the achievements list hints at them. print(text, type) adds a line,
// append(node) adds an element. Each command gets the words typed after it.
function hiddenCommands({ print, append }) {
  // Print lines one at a time, like a real network tool waiting on replies
  function slowly(lines, gap = 450) {
    lines.forEach((line, i) => {
      setTimeout(() => {
        if (Array.isArray(line)) print(line[0], line[1]);
        else print(line);
      }, (i + 1) * gap);
    });
  }

  const tracert = (args) => {
    achievements.unlock('tracert');
    const target = args[0] ? args[0] + ' [ashton.redsky@gmail.com]' : 'your-inbox [ashton.redsky@gmail.com]';
    print('Tracing route to ' + target);
    print('over a maximum of 30 hops:');
    slowly([
      '',
      '  1    <1 ms  home-base.alabama.local [192.168.1.1]',
      '  2     2 ms  core-sw01.goodwill.lan [10.0.0.1]',
      '  3     5 ms  fw01.allow-recruiters [10.0.0.254]',
      '  4     9 ms  s-band.uplink.mission-control [172.16.0.1]',
      '  5      *    Request timed out.  (refilling coffee)',
      '  6    23 ms  ' + target,
      '',
      ['Trace complete. Shortest route: ashton.redsky@gmail.com', 't-ok'],
    ], 500);
  };

  const nslookup = (args) => {
    achievements.unlock('nslookup');
    const name = (args[0] || 'ashton').toLowerCase();
    print('Server:   dns.mission-control.local');
    print('Address:  10.0.0.53');
    print('');
    if (!/^ashton/.test(name) && name !== 'lee') {
      print('*** dns.mission-control.local can\'t find ' + name + ': Non-existent domain', 't-error');
      print('Try: nslookup ashton');
      return;
    }
    slowly([
      'Name:     ashton-lee.netadmin',
      'Address:  ashton.redsky@gmail.com',
      'Aliases:  it-specialist, programmer, eagle-scout,',
      '          guitarist, rider, gamer',
    ], 250);
  };

  return {
    ping: (args) => {
      achievements.unlock('ping');
      const host = (args[0] || 'ashton').toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        print('There\'s no place like 127.0.0.1.', 't-ok');
        return;
      }
      const isAshton = /^ashton/.test(host);
      const name = isAshton ? 'ashton-lee.local' : host;
      const ip = isAshton ? '10.0.0.64' : '198.51.100.' + (20 + (host.length * 7) % 200);
      print('Pinging ' + name + ' [' + ip + '] with 32 bytes of data:');
      const time = () => (isAshton ? 'time<1ms' : 'time=' + (12 + Math.floor(Math.random() * 20)) + 'ms');
      slowly([
        'Reply from ' + ip + ': bytes=32 ' + time() + ' TTL=128',
        'Reply from ' + ip + ': bytes=32 ' + time() + ' TTL=128',
        'Reply from ' + ip + ': bytes=32 ' + time() + ' TTL=128',
        'Reply from ' + ip + ': bytes=32 ' + time() + ' TTL=128',
        '',
        'Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)',
        isAshton ? ['Ashton is online and replies faster than a ticket queue.', 't-ok'] : '',
      ]);
    },
    tracert,
    traceroute: tracert,
    nslookup,
    dig: nslookup,
    // A small globe that spins round to Ashton's home, Huntsville, Alabama
    globe: () => {
      achievements.unlock('globe');
      print('Locating home base...');
      const figure = document.createElement('div');
      figure.className = 't-globe';
      const pre = document.createElement('pre');
      const caption = document.createElement('p');
      figure.append(pre, caption);
      append(figure);
      const planet = createAsciiPlanet(pre, caption, { rows: 13 });
      planet.start();
      append(figure);   // again, now it has content, so the terminal scrolls down to it
      planet.spinHome(() => setTimeout(() => planet.stop(), 3000));
    },
    achievements: () => print(achievements.report()),
  };
}

// ---------- Easter eggs on the page itself ----------
function initEasterEggs() {
  const root = document.documentElement;
  const frame = document.getElementById('mfd');

  // ----- Developer console: a note for the curious -----
  console.log(
    '%c\n' +
    '  __  __ ___ ___    ____\n' +
    ' |  \\/  | __|   \\  |__ /\n' +
    ' | |\\/| | _|| |) |  |_ \\\n' +
    ' |_|  |_|_| |___/  |___/\n',
    'color:#4cc9f0;font-family:monospace;font-weight:bold'
  );
  console.log(
    '%cHi, curious one.%c\n' +
    'This site is hand-built: plain HTML, CSS and JavaScript, no frameworks.\n' +
    'Easter eggs are hidden around it. Type %cashton.hello()%c to unlock one right now,\n' +
    'or %cashton.achievements()%c to see what you have found.\n' +
    'Say hi: ashton.redsky@gmail.com',
    'color:#4cc9f0;font-size:14px;font-weight:bold', '',
    'color:#ffb347;font-family:monospace', '',
    'color:#ffb347;font-family:monospace', ''
  );
  window.ashton = {
    hello() {
      achievements.unlock('devtools');
      return 'Achievement unlocked: Under the hood. Thanks for looking under the hood.';
    },
    achievements() {
      return achievements.report();
    },
  };

  // ----- Day / night: the sun rises over the Moon and Earth comes fully lit -----
  document.addEventListener('themechange', (event) => {
    if (event.detail === 'light') {
      showToast('DAY · SUNRISE OVER THE LUNAR HORIZON', 'setting');
      achievements.unlock('daylight');
    } else {
      showToast('NGT · EARTHRISE OVER THE MOON', 'setting');
    }
  });

  // ----- Konami code: amber phosphor ("night ops") -----
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let progress = 0;
  document.addEventListener('keydown', (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    progress = key === KONAMI[progress] ? progress + 1 : key === KONAMI[0] ? 1 : 0;
    if (progress < KONAMI.length) return;
    progress = 0;
    const amber = root.dataset.phosphor !== 'amber';
    if (amber) root.dataset.phosphor = 'amber';
    else delete root.dataset.phosphor;
    showToast(amber ? 'AMBER PHOSPHOR · NIGHT OPS' : 'BLUE PHOSPHOR · STANDARD OPS');
    achievements.unlock('konami');
  });

  // ----- Rocker switches: brightness, contrast, symbology, gain -----
  const screen = { brt: 1, con: 1, sym: 1 };
  const LIMITS = { brt: [0.4, 1.45], con: [0.55, 1.6], sym: [0.25, 1] };

  function applyScreen() {
    root.style.setProperty('--scr-brt', screen.brt);
    root.style.setProperty('--scr-con', screen.con);
    root.style.setProperty('--sym', screen.sym);
    root.classList.toggle('tuned', screen.brt !== 1 || screen.con !== 1);
  }

  frame.querySelectorAll('.rocker').forEach((rocker) => {
    const setting = rocker.dataset.rocker;
    rocker.querySelectorAll('button').forEach((half) => {
      half.addEventListener('click', (event) => {
        event.stopPropagation();
        const step = Number(half.dataset.step);
        rocker.classList.remove('tilt-up', 'tilt-down');
        void rocker.offsetWidth;   // restart the tilt
        rocker.classList.add(step > 0 ? 'tilt-up' : 'tilt-down');
        achievements.unlock('tune');

        if (setting === 'gain') {
          showToast('GAIN · NO SENSOR ATTACHED', 'setting');
          return;
        }
        const [min, max] = LIMITS[setting];
        const amount = setting === 'sym' ? 0.25 : 0.15;
        screen[setting] = Math.round(Math.min(max, Math.max(min, screen[setting] + step * amount)) * 100) / 100;
        applyScreen();
        showToast(setting.toUpperCase() + ' ' + Math.round(screen[setting] * 100) + '%', 'setting');
      });
    });
  });

  // ----- PWR lamp: power the display off and on again -----
  const powerButton = frame.querySelector('.mfd-power');
  let cycling = false;
  powerButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (cycling) return;
    cycling = true;
    frame.classList.add('power-down');
    setTimeout(() => {
      frame.classList.add('powered-off');
      frame.classList.remove('power-down');
    }, 700);
    setTimeout(() => {
      frame.classList.add('power-up');
      frame.classList.remove('powered-off');
    }, 1900);
    setTimeout(() => {
      frame.classList.remove('power-up');
      cycling = false;
      showToast('HAVE YOU TRIED TURNING IT OFF AND ON AGAIN? ✓');
      achievements.unlock('power');
    }, 2600);
  });

  // ----- Blank keys: a self-test and a master caution -----
  const selftest = frame.querySelector('.mfd-selftest');
  const selftestLines = document.getElementById('selftest-lines');
  let testing = false;

  function selfTest() {
    if (testing) return;
    testing = true;
    selftestLines.textContent = '';
    frame.classList.add('self-testing');
    const lines = ['RAM ........... OK', 'ROM ........... OK', 'PIXELS ........ OK', 'KEYS .......... OK', 'BUS 1-4 ....... OK', '', 'RESULT: PASS'];
    lines.forEach((line, i) => {
      setTimeout(() => { selftestLines.textContent += line + '\n'; }, 350 + i * 260);
    });
    setTimeout(() => {
      frame.classList.remove('self-testing');
      testing = false;
      achievements.unlock('selftest');
    }, 350 + lines.length * 260 + 1200);
  }
  selftest.addEventListener('click', (event) => event.stopPropagation());

  const caution = frame.querySelector('.mfd-caution');
  function setCaution(on) {
    caution.classList.toggle('lit', on);
    if (on) {
      showToast('MASTER CAUTION · COFFEE LEVEL LOW');
      achievements.unlock('caution');
    }
  }
  caution.addEventListener('click', (event) => {
    event.stopPropagation();
    if (caution.classList.contains('lit')) setCaution(false);
  });

  // Three presses within a second and a half on a top-corner blank key runs the self-test;
  // one press on a bottom-corner blank key sets off (or acknowledges) the master caution
  const presses = {};
  frame.querySelectorAll('.osb[data-key="l1"], .osb[data-key="r1"]').forEach((key) => {
    key.addEventListener('click', () => {
      const now = Date.now();
      const recent = (presses[key.dataset.key] || []).filter((t) => now - t < 1500);
      recent.push(now);
      presses[key.dataset.key] = recent;
      if (recent.length >= 3) {
        presses[key.dataset.key] = [];
        selfTest();
      }
    });
  });
  frame.querySelectorAll('.osb[data-key="l5"], .osb[data-key="r5"]').forEach((key) => {
    key.addEventListener('click', () => setCaution(!caution.classList.contains('lit')));
  });

  // ----- Hubble: click it to lock on and read out its orbit -----
  const satellite = document.querySelector('.satellite');
  let locked = null;
  satellite.addEventListener('click', () => {
    // Put the readout on whichever side has room
    const craft = satellite.getBoundingClientRect();
    const hero = satellite.closest('.hero').getBoundingClientRect();
    satellite.classList.toggle('readout-left', craft.left - hero.left > hero.width * 0.6);
    satellite.classList.add('locked');
    clearTimeout(locked);
    locked = setTimeout(() => satellite.classList.remove('locked'), 7000);
    achievements.unlock('hubble');
  });
}
