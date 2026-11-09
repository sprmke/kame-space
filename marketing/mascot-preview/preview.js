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
      // A coordinated performance with anchored feet and contact shadow.
      // Inverse texture-space transforms keep the existing rendered lighting.
      float settle=1.-smoothstep(6.1,6.9,time);
      float body=1.-smoothstep(960.,1130.,p.y);
      p.x+=(sin(time*1.9)*11.+sin(time*.85)*6.)*body*motion;
      p.y+=sin(time*2.5)*5.*body*motion;
      float nod=exp(-pow((time-.7)/.24,2.))+exp(-pow((time-2.8)/.3,2.))*.8+exp(-pow((time-5.5)/.35,2.));
      vec2 h=(p-vec2(640.,385.))/vec2(350.,295.);
      float head=1.-smoothstep(.8,1.15,length(h));
      float angle=(sin(time*1.5)*.045+sin(time*.7)*.018)*motion*head;
      vec2 q=p-vec2(625.,610.);
      p=vec2(cos(angle)*q.x-sin(angle)*q.y,sin(angle)*q.x+cos(angle)*q.y)+vec2(625.,610.);
      p.y+=nod*13.*head*motion*settle;
      float hand=(1.-smoothstep(350.,465.,p.x))*smoothstep(420.,500.,p.y)*(1.-smoothstep(660.,760.,p.y));
      float hello=sin(time*7.5)*pow(sin(clamp(time/2.3,0.,1.)*3.14159265),2.)*step(time,2.3);
      float explain=sin((time-2.3)*3.8)*smoothstep(2.3,2.7,time)*(1.-smoothstep(5.9,6.6,time));
      float handAngle=(hello*.27+explain*.18)*hand*motion;
      vec2 arm=p-vec2(445.,713.);
      p=vec2(cos(handAngle)*arm.x-sin(handAngle)*arm.y,sin(handAngle)*arm.x+cos(handAngle)*arm.y)+vec2(445.,713.);
      float other=smoothstep(770.,855.,p.x)*(1.-smoothstep(945.,1010.,p.x))*smoothstep(635.,730.,p.y)*(1.-smoothstep(920.,1000.,p.y));
      float offer=sin(time*2.7)*smoothstep(2.,2.6,time)*settle*motion;
      p.x-=offer*25.*other;p.y+=offer*10.*other;
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
    gl.uniform1f(m, motion);
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
  function renderAt(time, speaking = true, performanceTime = time) {
    const moving = $('motion').checked;
    const strength = moving ? Number($('energy').value) : 0;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
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
    drawGL(performanceTime, strength);
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
