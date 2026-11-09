import { createRig } from './rig.js';
import { actions, sampleAction, neutral, ActionPlayer } from './motion.mjs';
// Standalone review prototype. No live service, tracking, or app integration.
const $ = (id) => document.getElementById(id);
const W = 1220,
  H = 1289;
const canvas = $('mascot'),
  small = $('small'),
  audio = $('audio');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
$('motion').checked = !reduced.matches;
reduced.addEventListener('change', () => {
  $('motion').checked = !reduced.matches;
});
const plate = document.createElement('canvas');
plate.width = W;
plate.height = H;
const ctx = plate.getContext('2d');
const smallCtx = small.getContext('2d');
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error(`Could not load ${src}`));
    i.src = src;
  });
const response = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${url}`);
  return r.json();
};
let manualTime = null;

function extractEye(source, rect) {
  const [x, y, w, h] = rect;
  const eye = document.createElement('canvas');
  eye.width = w;
  eye.height = h;
  const c = eye.getContext('2d');
  c.drawImage(source, x, y, w, h, 0, 0, w, h);
  // Keep original rendered eyes and their antialiased shading. Feather only
  // the surrounding skin into the matched clean plate, avoiding a hard seam.
  c.globalCompositeOperation = 'destination-in';
  c.translate(w / 2, h / 2);
  c.scale(w / 2, h / 2);
  const mask = c.createRadialGradient(0, 0, 0.78, 0, 0, 1);
  mask.addColorStop(0, '#000');
  mask.addColorStop(1, 'transparent');
  c.fillStyle = mask;
  c.fillRect(-1, -1, 2, 2);
  return { image: eye, rect };
}
function extractMouths(atlas) {
  const a = document.createElement('canvas');
  a.width = atlas.width;
  a.height = atlas.height;
  const c = a.getContext('2d');
  c.drawImage(atlas, 0, 0);
  const d = c.getImageData(0, 0, a.width, a.height).data;
  return Object.fromEntries(
    ['X', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((key, n) => {
      const x0 = Math.round(((n % 3) * a.width) / 3),
        x1 = Math.round((((n % 3) + 1) * a.width) / 3),
        y0 = Math.round((Math.floor(n / 3) * a.height) / 3),
        y1 = Math.round(((Math.floor(n / 3) + 1) * a.height) / 3);
      let l = x1,
        t = y1,
        r = x0,
        b = y0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++)
          if (d[(y * a.width + x) * 4 + 3] > 35) {
            l = Math.min(l, x);
            r = Math.max(r, x);
            t = Math.min(t, y);
            b = Math.max(b, y);
          }
      if (r <= l || b <= t) throw new Error(`Missing mouth sprite ${key}`);
      return [key, [Math.max(x0, l - 2), Math.max(y0, t - 2), r - l + 5, b - t + 5]];
    })
  );
}
const sizes = {
  X: [158, 27],
  A: [148, 19],
  B: [154, 43],
  C: [159, 68],
  D: [166, 94],
  E: [103, 68],
  F: [75, 61],
  G: [140, 32],
  H: [147, 74],
};

async function init() {
  const [source, base, parts, torso, atlas, cues] = await Promise.all([
    loadImage('assets/welcome.png'),
    loadImage('assets/head-layer.png'),
    loadImage('assets/body-parts.png'),
    loadImage('assets/torso-layer.png'),
    loadImage('assets/mouth-atlas.png'),
    response('assets/greeting-cues.json'),
  ]);
  const eyes = [extractEye(source, [415, 270, 145, 160]), extractEye(source, [690, 325, 150, 165])];
  const mouths = extractMouths(atlas),
    rig = createRig(canvas, parts, torso);
  const player = new ActionPlayer();
  let gestureClock = 0,
    lastTick = null,
    gesturePaused = false,
    demo = false,
    demoIndex = 0;
  let currentPose = neutral();
  let animatedStrength = 1;
  const drawMouth = (key, alpha = 1) => {
    const [w, h] = sizes[key];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(607, 492);
    ctx.rotate(0.155);
    ctx.drawImage(atlas, ...mouths[key], -w / 2, key === 'X' || key === 'A' ? -3 : -19, w, h);
    ctx.restore();
  };
  function renderAt(time, speaking = true, performanceTime = time, explicitPose = null) {
    const moving = $('motion').checked;
    const strength = moving ? animatedStrength : 0;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    currentPose = moving ? explicitPose || player.sample(gestureClock, strength) : neutral();
    let blink = 1;
    if (moving) {
      for (const at of [1.55, 3.95, 4.24, 7.7, 11.2]) {
        const d = (performanceTime % 14) - at;
        if (d > -0.075 && d < 0.15) {
          const openness = d < 0 ? -d / 0.075 : d / 0.15;
          blink = Math.min(blink, 0.035 + 0.965 * openness * openness * (3 - 2 * openness));
        }
      }
    }
    blink = Math.min(blink, 1 - currentPose.eyeClose);
    for (const {
      image,
      rect: [x, y, w, h],
    } of eyes) {
      ctx.save();
      ctx.translate(x + w / 2, y + h * 0.6);
      ctx.scale(1, blink);
      ctx.drawImage(image, -w / 2, -h * 0.6);
      ctx.restore();
    }
    const index = speaking ? cues.mouthCues.findIndex((c) => time >= c.start && time < c.end) : -1;
    const cue =
      index >= 0 ? cues.mouthCues[index] : { value: currentPose.laugh > 0.3 ? 'D' : 'X', start: 0 };
    const previous = index > 0 ? cues.mouthCues[index - 1].value : 'X';
    const rawBlend =
      index >= 0
        ? Math.min(
            1,
            Math.max(0, (time - cue.start) / Math.min(0.065, (cue.end - cue.start) * 0.45))
          )
        : 1;
    const blend = rawBlend * rawBlend * (3 - 2 * rawBlend);
    if (previous !== cue.value && blend < 1) drawMouth(previous, 1 - blend);
    drawMouth(cue.value, previous === cue.value ? 1 : blend);
    rig.draw(plate, currentPose);
    smallCtx.clearRect(0, 0, 320, 320);
    smallCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 9, 0, 302, 320);
    if (manualTime === null) {
      const selected = player.transition?.next || player.name;
      $('gesture-status').textContent = actions[selected].label;
      document.querySelectorAll('[data-action]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.action === selected));
      });
    }
    $('cue').textContent = `${time.toFixed(2)} s · mouth ${cue.value}`;
    $('progress').value = Math.min(1, time / cues.metadata.duration);
    return cue.value;
  }
  function sync() {
    const active = !audio.paused && !audio.ended;
    $('play').textContent = active
      ? 'Pause greeting'
      : audio.currentTime > 0 && !audio.ended
        ? 'Resume greeting'
        : 'Play greeting';
    $('status').textContent = active
      ? 'Speaking'
      : audio.ended
        ? 'Greeting complete'
        : 'Ready to say hello';
    $('dot').parentElement.classList.toggle('playing', active);
  }
  async function play(restart = false) {
    if (restart || audio.ended) audio.currentTime = 0;
    try {
      await audio.play();
    } catch (e) {
      $('error').hidden = false;
      $('error').textContent = `Playback could not start: ${e.message}`;
    }
  }
  $('play').onclick = () => {
    if (audio.paused) {
      trigger('wave');
      play();
    } else audio.pause();
  };
  $('replay').onclick = () => {
    trigger('wave');
    play(true);
  };
  for (const event of ['play', 'pause', 'ended', 'seeked']) audio.addEventListener(event, sync);
  for (const id of ['play', 'replay', 'demo', 'pause-motion']) $(id).disabled = false;
  $('guide').onchange = () => {
    $('timing').hidden = !$('guide').checked;
  };
  document.querySelectorAll('[data-bg]').forEach(
    (button) =>
      (button.onclick = () => {
        document.querySelectorAll('.surface').forEach((e) => {
          e.classList.remove('light', 'mint', 'dark', 'grid');
          e.classList.add(button.dataset.bg);
        });
        document
          .querySelectorAll('[data-bg]')
          .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      })
  );
  audio.addEventListener('error', () => {
    $('error').hidden = false;
    $('error').textContent = 'The sample audio could not load. Reload the preview.';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause();
  });

  function trigger(name, stopDemo = true) {
    if (stopDemo) demo = false;
    manualTime = null;
    gesturePaused = false;
    $('pause-motion').textContent = 'Pause motion';
    player.play(name, gestureClock, animatedStrength);
    document.querySelectorAll('[data-action]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.action === name));
    });
    $('gesture-status').textContent = actions[name].label;
  }
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.disabled = false;
    button.onclick = () => trigger(button.dataset.action);
  });
  $('pause-motion').onclick = () => {
    manualTime = null;
    gesturePaused = !gesturePaused;
    $('pause-motion').textContent = gesturePaused ? 'Resume motion' : 'Pause motion';
  };
  $('demo').onclick = () => {
    demoIndex = 0;
    trigger('idle');
    demo = true;
  };
  $('motion').addEventListener('change', () => {
    if (!$('motion').checked) {
      demo = false;
      player.play('idle', gestureClock);
    }
  });

  function loop(now) {
    const dt = lastTick === null ? 0 : Math.min(0.05, (now - lastTick) / 1000);
    lastTick = now;
    if (manualTime === null) {
      if (!gesturePaused && !document.hidden && $('motion').checked) {
        gestureClock += dt;
        animatedStrength +=
          (Number($('energy').value) - animatedStrength) * (1 - Math.exp(-dt / 0.15));
      }
      if (demo && !player.transition && player.name === 'idle') {
        const sequence = Object.keys(actions).filter((name) => name !== 'idle');
        if (demoIndex < sequence.length) trigger(sequence[demoIndex++], false);
        else demo = false;
      }
      const speaking = !audio.paused && !audio.ended;
      renderAt(audio.currentTime, speaking, gestureClock);
    }
    requestAnimationFrame(loop);
  }
  window.kamePreview = {
    ready: true,
    duration: cues.metadata.duration,
    cues: cues.mouthCues,
    renderAt(time) {
      manualTime = time;
      const pose = sampleAction('wave', time % actions.wave.duration, Number($('energy').value));
      return renderAt(time, true, time, pose);
    },
    renderAction(name, time, strength = 1) {
      manualTime = time;
      const pose = sampleAction(name, time, strength);
      renderAt(0, false, time, pose);
      return pose;
    },
    actions,
    playAction(name) {
      trigger(name);
    },
    state() {
      return {
        name: player.name,
        pending: player.transition?.next,
        gestureClock,
        gesturePaused,
        demo,
        pose: currentPose,
      };
    },
    resume() {
      manualTime = null;
    },
    setBackground(value) {
      document.querySelector(`[data-bg="${value}"]`).click();
    },
    alphaStats() {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let zero = 0,
        partial = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] === 0) zero++;
        else if (data[i] < 255) partial++;
      }
      return { zero, partial, pixels: canvas.width * canvas.height };
    },
  };
  sync();
  renderAt(0, false);
  requestAnimationFrame(loop);
}
init().catch((error) => {
  $('error').hidden = false;
  $('error').textContent = error.message;
  $('status').textContent = 'Preview unavailable';
  console.error(error);
});
