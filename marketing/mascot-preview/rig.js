export const WIDTH = 1220,
  HEIGHT = 1289;
function surface(w = WIDTH, h = HEIGHT) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function atlasParts(image) {
  const c = surface(image.width, image.height),
    ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  return Array.from({ length: 6 }, (_, n) => {
    const x0 = ((n % 3) * c.width) / 3,
      y0 = (Math.floor(n / 3) * c.height) / 2;
    let l = x0 + c.width / 3,
      r = x0,
      t = y0 + c.height / 2,
      b = y0;
    for (let y = y0; y < y0 + c.height / 2; y++)
      for (let x = x0; x < x0 + c.width / 3; x++)
        if (data[(y * c.width + x) * 4 + 3] > 100) {
          l = Math.min(l, x);
          r = Math.max(r, x);
          t = Math.min(t, y);
          b = Math.max(b, y);
        }
    if (r <= l || b <= t) throw new Error(`Missing body part ${n}`);
    const crop = surface(r - l + 5, b - t + 5);
    crop
      .getContext('2d')
      .drawImage(image, l - 2, t - 2, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return crop;
  });
}
export function createRig(canvas, partsImage, torsoImage) {
  const [, leftArm, rightArm, leftLeg, rightLeg] = atlasParts(partsImage);
  const c = canvas.getContext('2d');
  // Static rest dimensions. All animated transforms below are isometries.
  function limb(image, rect, pivot, angle) {
    c.save();
    c.translate(...pivot);
    c.rotate(angle);
    c.translate(-pivot[0], -pivot[1]);
    c.drawImage(image, ...rect);
    c.restore();
  }
  return {
    draw(face, pose) {
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.save();
      c.scale(canvas.width / WIDTH, canvas.height / HEIGHT);
      // Shadow is a separate layer. It stays on the floor during jumps.
      c.save();
      c.translate(610, 1143);
      c.scale(1 - pose.lift / 420, 0.12);
      const shadow = c.createRadialGradient(0, 0, 20, 0, 0, 350);
      shadow.addColorStop(0, `rgba(26,44,33,${0.25 - pose.lift / 800})`);
      shadow.addColorStop(0.65, `rgba(26,44,33,${0.15 - pose.lift / 1200})`);
      shadow.addColorStop(1, 'rgba(26,44,33,0)');
      c.fillStyle = shadow;
      c.fillRect(-360, -360, 720, 720);
      c.restore();
      c.translate(0, -pose.lift);
      // Feet remain planted through small torso motion, and rotate at the hip
      // while the torso lowers into the seated pose.
      const sit = pose.hipY;
      c.save();
      c.translate(0, sit);
      limb(leftLeg, [325, 890, 240, 255], [460, 958], pose.leftLeg);
      limb(rightLeg, [640, 890, 240, 255], [745, 958], pose.rightLeg);
      c.restore();
      c.translate(620, 970 + pose.bodyY);
      c.rotate(pose.bodyAngle);
      c.translate(-620, -970);

      // Complete torso hides the hips and upper arm joints.
      c.drawImage(torsoImage, 251, 638, 607, 530, 313, 590, 624, 468);
      limb(leftArm, [237, 488, 303, 250], [490, 675], pose.leftArm);
      // Front body occludes the attachment pads; the orange shell stays behind
      // the arms. Rounded shoulders overlap inside this green skin silhouette.
      c.save();
      c.beginPath();
      c.moveTo(490, 620);
      c.bezierCurveTo(560, 585, 690, 605, 748, 666);
      c.bezierCurveTo(800, 730, 820, 865, 780, 958);
      c.bezierCurveTo(730, 1040, 535, 1040, 440, 966);
      c.bezierCurveTo(370, 898, 370, 770, 430, 686);
      c.closePath();
      c.clip();
      c.drawImage(torsoImage, 251, 638, 607, 530, 313, 590, 624, 468);
      c.restore();
      c.save();
      c.translate(625, 620 + pose.headY);
      c.rotate(pose.headAngle);
      c.translate(-625, -620);
      c.drawImage(face, 0, 0);
      c.restore();
      // One uncut arm layer passes in front of the chin while thinking.
      // Keeping the complete limb avoids a sliced edge at the wrist.
      limb(rightArm, [745, 645, 175, 300], [777, 690], pose.rightArm);
      c.restore();
    },
  };
}
