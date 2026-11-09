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

function renderer() {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    antialias: true,
  });
  if (!gl) throw new Error('This motion preview needs WebGL. Try another browser.');
  const shader = (type, code) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, code);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(
    program,
    shader(
      gl.VERTEX_SHADER,
      'attribute vec2 p; varying vec2 uv; void main(){uv=(p+1.0)*0.5;gl_Position=vec4(p,0.,1.);}'
    )
  );
  gl.attachShader(
    program,
    shader(
      gl.FRAGMENT_SHADER,
      `precision highp float; varying vec2 uv; uniform sampler2D art; uniform float time; uniform float motion;
    void main(){
      vec2 p=vec2(uv.x,1.-uv.y)*vec2(1220.,1289.);
      // The feet and soft shadow stay anchored. Deformations are small and local.
      float body=1.-smoothstep(1010.,1140.,p.y);
      p.y+=sin(time*2.0)*2.5*body*motion;
      vec2 h=(p-vec2(640.,385.))/vec2(350.,295.);
      float head=1.-smoothstep(.65,1.12,length(h));
      float angle=sin(time*1.45)*.014*motion*head;
      vec2 q=p-vec2(625.,590.);
      p=vec2(cos(angle)*q.x-sin(angle)*q.y,sin(angle)*q.x+cos(angle)*q.y)+vec2(625.,590.);
      float hand=(1.-smoothstep(340.,460.,p.x))*smoothstep(440.,500.,p.y)*(1.-smoothstep(625.,750.,p.y));
      float wave=sin(time*8.)*sin(min(time/2.7,1.)*3.14159265)*step(time,2.7);
      p.x+=wave*17.*hand*motion;p.y+=wave*9.*hand*motion;
      vec4 color=texture2D(art,p/vec2(1220.,1289.));gl_FragColor=color;
    }`
    )
  );
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  const pos = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const t = gl.getUniformLocation(program, 'time'),
    m = gl.getUniformLocation(program, 'motion');
  return (time, motion) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, plate);
    gl.uniform1f(t, time);
    gl.uniform1f(m, motion ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
}

async function init() {
  const [source, base, atlas, cues] = await Promise.all([
    loadImage('assets/welcome.png'),
    loadImage('assets/face-base.png'),
    loadImage('assets/mouth-atlas.png'),
    response('assets/greeting-cues.json'),
  ]);
  const eyes = [extractEye(source, [415, 270, 145, 160]), extractEye(source, [690, 325, 150, 165])];
  const mouths = extractMouths(atlas),
    drawGL = renderer();
  const drawMouth = (key, alpha = 1) => {
    const [w, h] = sizes[key];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(607, 492);
    ctx.rotate(0.155);
    ctx.drawImage(atlas, ...mouths[key], -w / 2, key === 'X' || key === 'A' ? -3 : -19, w, h);
    ctx.restore();
  };
  function renderAt(time, speaking = true) {
    const moving = $('motion').checked;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    let blink = 1;
    if (moving) {
      for (const at of [1.6, 4.8, 8.3, 11.6]) {
        const d = Math.abs((time % 14) - at);
        if (d < 0.105) blink = Math.min(blink, Math.max(0.035, d / 0.105));
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
    const blend = index >= 0 ? Math.min(1, Math.max(0, (time - cue.start) / 0.035)) : 1;
    if (previous !== cue.value && blend < 1) drawMouth(previous, 1 - blend);
    drawMouth(cue.value, previous === cue.value ? 1 : blend);
    drawGL(time, moving);
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
  let last = 0;
  function loop(now) {
    if (manualTime === null && now - last > 1000 / 30) {
      renderAt(audio.currentTime, !audio.paused && !audio.ended);
      last = now;
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
      const data = ctx.getImageData(0, 0, W, H).data;
      let zero = 0,
        partial = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] === 0) zero++;
        else if (data[i] < 255) partial++;
      }
      return { zero, partial, pixels: W * H };
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
