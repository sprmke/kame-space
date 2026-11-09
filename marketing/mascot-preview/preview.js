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

// Rigid layer motion only. Never displace pixels through spatial masks: masks
// that overlap a cheek or torso deform those surfaces as gesture strength grows.
function armOutline(c) {
  c.beginPath();
  c.moveTo(190, 478);
  c.lineTo(328, 478);
  c.lineTo(355, 512);
  c.lineTo(380, 549);
  c.lineTo(417, 582);
  c.lineTo(460, 611);
  c.lineTo(505, 635);
  c.lineTo(500, 648);
  c.lineTo(413, 739);
  c.lineTo(339, 714);
  c.lineTo(255, 665);
  c.lineTo(190, 590);
  c.closePath();
}
function renderer(base, repair) {
  const output = canvas.getContext('2d');
  const arm = document.createElement('canvas');
  arm.width = W;
  arm.height = H;
  const ac = arm.getContext('2d');
  ac.save();
  // Stay inside the arm's upper edge: the adjacent cheek must never enter
  // this moving layer, including its antialiased boundary pixels.
  ac.beginPath();
  ac.moveTo(190, 478);
  ac.lineTo(324, 478);
  ac.lineTo(330, 518);
  ac.lineTo(353, 555);
  ac.lineTo(390, 590);
  ac.lineTo(435, 621);
  ac.lineTo(480, 643);
  ac.lineTo(500, 648);
  ac.lineTo(413, 739);
  ac.lineTo(339, 714);
  ac.lineTo(255, 665);
  ac.lineTo(190, 590);
  ac.closePath();
  ac.clip();
  ac.drawImage(base, 0, 0, W, H);
  ac.restore();

  const clean = document.createElement('canvas');
  clean.width = W;
  clean.height = H;
  const cc = clean.getContext('2d');
  cc.drawImage(base, 0, 0, W, H);
  cc.save();
  armOutline(cc);
  cc.clip();
  cc.clearRect(0, 0, W, H);
  cc.drawImage(repair, 0, 0, W, H);
  cc.restore();

  return {
    clean,
    draw(time, strength) {
      const motion = Math.max(0, Math.min(1.5, Number.isFinite(strength) ? strength : 0));
      const smooth = (x) => {
        const v = Math.max(0, Math.min(1, x));
        return v * v * (3 - 2 * v);
      };
      const hello =
        time < 2.3 ? Math.sin(time * 7.5) * Math.sin((Math.max(0, time) / 2.3) * Math.PI) ** 2 : 0;
      const explain =
        Math.sin((time - 2.3) * 3.8) *
        smooth((time - 2.3) / 0.4) *
        (1 - smooth((time - 5.9) / 0.7));
      // Maximum 8.6 degrees. No scale, shear, or per-pixel deformation.
      const angle = (hello * 0.1 + explain * 0.065) * motion;
      output.clearRect(0, 0, canvas.width, canvas.height);
      output.drawImage(plate, 0, 0, canvas.width, canvas.height);
      output.save();
      output.scale(canvas.width / W, canvas.height / H);
      output.translate(458, 676);
      output.rotate(angle);
      output.translate(-458, -676);
      output.drawImage(arm, 0, 0);
      output.restore();
      // Original face and front torso occlude the rotating shoulder. The shell
      // remains behind the arm. This is draw order, not a deformation mask.
      output.save();
      output.scale(canvas.width / W, canvas.height / H);
      output.beginPath();
      output.moveTo(300, 0);
      output.lineTo(1100, 0);
      output.lineTo(1100, 1200);
      output.lineTo(390, 1200);
      output.lineTo(390, 820);
      output.lineTo(413, 739);
      output.lineTo(500, 648);
      output.lineTo(490, 635);
      output.lineTo(445, 611);
      output.lineTo(402, 582);
      output.lineTo(365, 549);
      output.lineTo(340, 512);
      output.lineTo(320, 460);
      output.lineTo(300, 400);
      output.closePath();
      output.clip();
      output.drawImage(plate, 0, 0);
      output.restore();
    },
  };
}

async function init() {
  const [source, base, repair, atlas, cues] = await Promise.all([
    loadImage('assets/welcome.png'),
    loadImage('assets/face-base.png'),
    loadImage('assets/arm-clean-plate.png'),
    loadImage('assets/mouth-atlas.png'),
    response('assets/greeting-cues.json'),
  ]);
  const eyes = [extractEye(source, [415, 270, 145, 160]), extractEye(source, [690, 325, 150, 165])];
  const mouths = extractMouths(atlas),
    rig = renderer(base, repair);
  const drawMouth = (key, alpha = 1) => {
    const [w, h] = sizes[key];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(607, 492);
    ctx.rotate(0.155);
    ctx.drawImage(atlas, ...mouths[key], -w / 2, key === 'X' || key === 'A' ? -3 : -19, w, h);
    ctx.restore();
  };
  function renderAt(time, speaking = true, performanceTime = time) {
    const moving = $('motion').checked;
    const strength = moving ? Number($('energy').value) : 0;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(rig.clean, 0, 0, W, H);
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
    const cue = index >= 0 ? cues.mouthCues[index] : { value: 'X', start: 0 };
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
    rig.draw(performanceTime, strength);
    smallCtx.clearRect(0, 0, 320, 320);
    smallCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 9, 0, 302, 320);
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
  $('play').onclick = () => (audio.paused ? play() : audio.pause());
  $('replay').onclick = () => play(true);
  for (const event of ['play', 'pause', 'ended', 'seeked']) audio.addEventListener(event, sync);
  for (const id of ['play', 'replay']) $(id).disabled = false;
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

  let idleStart = performance.now();
  let wasSpeaking = false;
  function loop(now) {
    if (manualTime === null) {
      const speaking = !audio.paused && !audio.ended;
      if (wasSpeaking && !speaking) idleStart = now;
      // Pause mid-sentence freezes the pose; before/after speech, idle stays alive.
      const idle = audio.currentTime === 0 || audio.ended;
      const motionTime = idle
        ? (audio.ended ? audio.duration : 7) + (now - idleStart) / 1000
        : audio.currentTime;
      renderAt(audio.currentTime, speaking, motionTime);
      wasSpeaking = speaking;
    }
    requestAnimationFrame(loop);
  }
  window.kamePreview = {
    ready: true,
    duration: cues.metadata.duration,
    cues: cues.mouthCues,
    renderAt(time) {
      manualTime = time;
      return renderAt(time, true);
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
