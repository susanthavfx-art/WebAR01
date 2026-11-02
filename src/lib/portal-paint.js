// Procedural artwork for AR portals. Everything here paints onto a 2D canvas
// so a portal needs no downloaded art: only the marker image comes from you.
import { portalWorld } from "./portal";

function canvas2d(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));
  const context = canvas.getContext("2d");
  return { canvas, context };
}

function vertical(context, width, height, stops) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function radial(context, x, y, radius, stops) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  context.fillStyle = gradient;
  return gradient;
}

function stars(context, width, height, count, random, colors, maxY = height) {
  for (let i = 0; i < count; i += 1) {
    const x = random() * width;
    const y = random() * maxY;
    const r = 0.4 + random() * 1.7;
    context.globalAlpha = 0.25 + random() * 0.75;
    context.fillStyle = colors[Math.floor(random() * colors.length)];
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function ridge(context, width, baseY, amplitude, color, random, teeth = 7) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(0, baseY + amplitude);
  let x = 0;
  const step = width / teeth;
  while (x < width + step) {
    const peak = baseY - amplitude * (0.35 + random() * 0.9);
    context.lineTo(x + step * (0.25 + random() * 0.2), peak);
    context.lineTo(x + step * (0.7 + random() * 0.2), baseY + amplitude * 0.28);
    x += step;
  }
  context.lineTo(width, baseY + amplitude * 1.6);
  context.lineTo(0, baseY + amplitude * 1.6);
  context.closePath();
  context.fill();
}

function softBlob(context, x, y, radius, inner, outer) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function leaf(context, x, y, size, angle, color) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(0, 0);
  context.quadraticCurveTo(size * 0.55, -size * 0.42, size, 0);
  context.quadraticCurveTo(size * 0.55, size * 0.42, 0, 0);
  context.fill();
  context.restore();
}

function randomFactory(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

const PAINTERS = {
  aurora(context, width, height, palette) {
    const random = randomFactory(7);
    vertical(context, width, height, [
      [0, palette[0]],
      [0.42, palette[1]],
      [0.72, "#122a52"],
      [1, "#0a1526"],
    ]);
    stars(
      context,
      width,
      height,
      150,
      random,
      ["#ffffff", "#cfe4ff", palette[3]],
      height * 0.72,
    );
    // Aurora ribbons.
    context.globalCompositeOperation = "screen";
    const ribbons = [
      [0.16, palette[3], 0.85],
      [0.3, palette[2], 0.7],
      [0.44, "#b19bff", 0.5],
    ];
    ribbons.forEach(([at, color, alpha], index) => {
      const gradient = context.createLinearGradient(
        0,
        height * at - 60,
        0,
        height * at + 90,
      );
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.globalAlpha = alpha;
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(0, height * at);
      context.bezierCurveTo(
        width * 0.3,
        height * (at - 0.12 - index * 0.02),
        width * 0.62,
        height * (at + 0.1),
        width,
        height * (at - 0.05),
      );
      context.lineTo(width, height * (at + 0.02));
      context.bezierCurveTo(
        width * 0.6,
        height * (at + 0.17),
        width * 0.3,
        height * (at - 0.04),
        0,
        height * (at + 0.08),
      );
      context.closePath();
      context.fill();
    });
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    softBlob(
      context,
      width * 0.78,
      height * 0.17,
      width * 0.09,
      "#fdfbf2",
      "rgba(253,251,242,0)",
    );
    ridge(context, width, height * 0.72, height * 0.13, "#10203a", random, 5);
    context.globalAlpha = 0.5;
    ridge(context, width, height * 0.79, height * 0.1, "#162b4a", random, 6);
    context.globalAlpha = 1;
    // Frozen lake with a soft light column.
    const lake = context.createLinearGradient(0, height * 0.78, 0, height);
    lake.addColorStop(0, "rgba(119,206,222,0.55)");
    lake.addColorStop(1, "rgba(10,21,38,0.95)");
    context.fillStyle = lake;
    context.fillRect(0, height * 0.78, width, height * 0.22);
    context.globalCompositeOperation = "screen";
    softBlob(
      context,
      width * 0.5,
      height * 0.9,
      width * 0.4,
      "rgba(142,240,201,0.35)",
      "rgba(142,240,201,0)",
    );
    context.globalCompositeOperation = "source-over";
  },

  jungle(context, width, height, palette) {
    const random = randomFactory(23);
    vertical(context, width, height, [
      [0, palette[0]],
      [0.35, palette[1]],
      [0.75, "#17512d"],
      [1, "#07210f"],
    ]);
    context.globalCompositeOperation = "screen";
    softBlob(
      context,
      width * 0.5,
      height * 0.5,
      width * 0.55,
      "rgba(244,221,122,0.55)",
      "rgba(244,221,122,0)",
    );
    context.globalCompositeOperation = "source-over";
    // Light shafts.
    context.save();
    context.globalCompositeOperation = "screen";
    for (let i = 0; i < 5; i += 1) {
      const x = width * (0.2 + i * 0.14);
      const gradient = context.createLinearGradient(
        x,
        0,
        x + width * 0.12,
        height,
      );
      gradient.addColorStop(0, "rgba(255,244,190,0.32)");
      gradient.addColorStop(1, "rgba(255,244,190,0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + width * 0.07, 0);
      context.lineTo(x + width * 0.22, height);
      context.lineTo(x + width * 0.02, height);
      context.closePath();
      context.fill();
    }
    context.restore();
    ridge(context, width, height * 0.62, height * 0.1, "#0d3a21", random, 6);
    ridge(context, width, height * 0.74, height * 0.09, "#0a2c19", random, 7);
    // Framing leaves.
    for (let i = 0; i < 34; i += 1) {
      const side = i % 2 === 0;
      const x = side
        ? -width * 0.05 + random() * width * 0.3
        : width * 0.95 - random() * width * 0.3;
      const y = random() * height;
      leaf(
        context,
        x,
        y,
        width * (0.1 + random() * 0.16),
        (side ? 0.4 : Math.PI - 0.4) + (random() - 0.5) * 0.9,
        i % 3 ? "#0e3d22" : "#155c31",
      );
    }
    // Fireflies.
    for (let i = 0; i < 26; i += 1) {
      softBlob(
        context,
        random() * width,
        height * (0.25 + random() * 0.7),
        6 + random() * 9,
        "rgba(244,221,122,0.9)",
        "rgba(244,221,122,0)",
      );
    }
  },

  cosmos(context, width, height, palette) {
    const random = randomFactory(91);
    vertical(context, width, height, [
      [0, palette[0]],
      [0.55, palette[1]],
      [1, "#0b0620"],
    ]);
    stars(context, width, height, 260, random, [
      "#ffffff",
      "#d9c7ff",
      "#ffe6ff",
    ]);
    context.globalCompositeOperation = "screen";
    softBlob(
      context,
      width * 0.32,
      height * 0.42,
      width * 0.6,
      "rgba(140,80,220,0.5)",
      "rgba(140,80,220,0)",
    );
    softBlob(
      context,
      width * 0.7,
      height * 0.34,
      width * 0.42,
      "rgba(255,120,200,0.42)",
      "rgba(255,120,200,0)",
    );
    softBlob(
      context,
      width * 0.55,
      height * 0.66,
      width * 0.5,
      "rgba(70,140,255,0.36)",
      "rgba(70,140,255,0)",
    );
    // Planet with a ring.
    const px = width * 0.66;
    const py = height * 0.3;
    const pr = width * 0.14;
    softBlob(
      context,
      px,
      py,
      pr * 2.2,
      "rgba(255,176,230,0.35)",
      "rgba(255,176,230,0)",
    );
    const planet = context.createRadialGradient(
      px - pr * 0.4,
      py - pr * 0.4,
      pr * 0.1,
      px,
      py,
      pr,
    );
    planet.addColorStop(0, "#ffe2f6");
    planet.addColorStop(0.5, "#b970d9");
    planet.addColorStop(1, "#472063");
    context.fillStyle = planet;
    context.beginPath();
    context.arc(px, py, pr, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255,220,250,0.65)";
    context.lineWidth = pr * 0.1;
    context.beginPath();
    context.ellipse(px, py, pr * 1.75, pr * 0.42, -0.4, 0, Math.PI * 2);
    context.stroke();
    context.globalCompositeOperation = "source-over";
    softBlob(
      context,
      width * 0.24,
      height * 0.62,
      width * 0.05,
      "rgba(206,230,255,0.9)",
      "rgba(206,230,255,0)",
    );
    // Distant dust clouds along the bottom edge.
    for (let i = 0; i < 5; i += 1) {
      const y = height * (0.78 + random() * 0.18);
      context.globalAlpha = 0.3 + random() * 0.3;
      ridge(context, width, y, height * 0.015, "#1a0f33", random, 9);
      context.globalAlpha = 1;
    }
  },

  sunset(context, width, height, palette) {
    const random = randomFactory(41);
    vertical(context, width, height, [
      [0, palette[0]],
      [0.3, palette[1]],
      [0.62, palette[2]],
      [0.82, palette[3]],
      [1, "#3a1220"],
    ]);
    softBlob(
      context,
      width * 0.5,
      height * 0.63,
      width * 0.34,
      "rgba(255,239,196,0.95)",
      "rgba(255,180,90,0)",
    );
    context.fillStyle = "#fff3cf";
    context.beginPath();
    context.arc(width * 0.5, height * 0.63, width * 0.11, 0, Math.PI * 2);
    context.fill();
    stars(
      context,
      width,
      height,
      60,
      random,
      ["#ffe9d0", "#ffd0b0"],
      height * 0.35,
    );
    ridge(context, width, height * 0.74, height * 0.06, "#59202c", random, 4);
    ridge(context, width, height * 0.83, height * 0.05, "#3a1220", random, 5);
    const dune = context.createLinearGradient(0, height * 0.86, 0, height);
    dune.addColorStop(0, "rgba(120,40,50,0.85)");
    dune.addColorStop(1, "rgba(30,10,20,0.98)");
    context.fillStyle = dune;
    context.beginPath();
    context.moveTo(0, height * 0.88);
    context.quadraticCurveTo(width * 0.4, height * 0.82, width, height * 0.9);
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(35,12,20,0.75)";
    context.lineWidth = 2.5;
    for (let i = 0; i < 5; i += 1) {
      const x = width * (0.1 + random() * 0.8);
      const y = height * (0.42 + random() * 0.16);
      const size = 5 + random() * 7;
      context.beginPath();
      context.moveTo(x - size, y);
      context.quadraticCurveTo(x - size * 0.5, y - size * 0.6, x, y);
      context.quadraticCurveTo(x + size * 0.5, y - size * 0.6, x + size, y);
      context.stroke();
    }
  },

  candy(context, width, height, palette) {
    const random = randomFactory(63);
    vertical(context, width, height, [
      [0, palette[0]],
      [0.35, palette[1]],
      [0.75, palette[2]],
      [1, palette[3]],
    ]);
    stars(
      context,
      width,
      height,
      70,
      random,
      ["#ffffff", "#ffe6f2"],
      height * 0.5,
    );
    // Rainbow arc.
    const colors = [
      "#ff9fc4",
      "#ffd39a",
      "#fff2a8",
      "#a9f0c1",
      "#a6d8ff",
      "#c9b6ff",
    ];
    context.save();
    context.globalAlpha = 0.5;
    colors.forEach((color, index) => {
      context.strokeStyle = color;
      context.lineWidth = width * 0.03;
      context.beginPath();
      context.arc(
        width * 0.5,
        height * 0.78,
        width * (0.46 - index * 0.032),
        Math.PI * 1.06,
        Math.PI * 1.94,
      );
      context.stroke();
    });
    context.restore();
    // Clouds.
    for (let i = 0; i < 9; i += 1) {
      const cx = random() * width;
      const cy = height * (0.35 + random() * 0.5);
      const size = width * (0.09 + random() * 0.1);
      context.globalAlpha = 0.85;
      for (let j = 0; j < 5; j += 1) {
        softBlob(
          context,
          cx + (random() - 0.5) * size * 1.6,
          cy + (random() - 0.5) * size * 0.5,
          size * (0.5 + random() * 0.5),
          "rgba(255,255,255,0.95)",
          "rgba(255,255,255,0)",
        );
      }
      context.globalAlpha = 1;
    }
    // Floating hearts and stars.
    for (let i = 0; i < 10; i += 1) {
      const x = random() * width;
      const y = height * (0.25 + random() * 0.55);
      const size = width * (0.02 + random() * 0.025);
      context.fillStyle =
        i % 2 ? "rgba(255,159,196,0.85)" : "rgba(255,242,168,0.9)";
      context.beginPath();
      context.moveTo(x, y + size);
      context.bezierCurveTo(
        x - size * 1.8,
        y - size * 0.6,
        x - size * 0.5,
        y - size * 1.8,
        x,
        y - size * 0.4,
      );
      context.bezierCurveTo(
        x + size * 0.5,
        y - size * 1.8,
        x + size * 1.8,
        y - size * 0.6,
        x,
        y + size,
      );
      context.fill();
    }
  },
};

export function paintWorldBackdrop(worldId, width = 720, height = 960) {
  const world = portalWorld(worldId);
  const { canvas, context } = canvas2d(width, height);
  (PAINTERS[world.id] || PAINTERS.aurora)(
    context,
    canvas.width,
    canvas.height,
    world.palette,
  );
  // Vignette keeps the eye inside the doorway.
  const vignette = context.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    Math.min(canvas.width, canvas.height) * 0.22,
    canvas.width / 2,
    canvas.height / 2,
    Math.max(canvas.width, canvas.height) * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

// The walls of the "well" below the card: light spills in at the card surface
// and fades to darkness deeper down. `axis` picks the gradient direction so the
// texture can follow the depth of every wall.
export function paintTunnel(color, glowColor, axis = "y") {
  const wide = axis === "x";
  const { canvas, context } = canvas2d(wide ? 512 : 64, wide ? 64 : 512);
  const gradient = wide
    ? context.createLinearGradient(0, 0, canvas.width, 0)
    : context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, glowColor);
  gradient.addColorStop(0.22, color);
  gradient.addColorStop(1, "#05040a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 0.18;
  if (wide) {
    for (let x = 0; x < canvas.width; x += 4) {
      context.fillStyle = x % 8 === 0 ? "#ffffff" : "#000000";
      context.fillRect(x, 0, 1, canvas.height);
    }
  } else {
    for (let y = 0; y < canvas.height; y += 4) {
      context.fillStyle = y % 8 === 0 ? "#ffffff" : "#000000";
      context.fillRect(0, y, canvas.width, 1);
    }
  }
  context.globalAlpha = 1;
  return canvas;
}

// Soft glow hugging the arch, drawn onto the card surface around the frame.
export function paintHalo(color, aspect = 1.3, ratio = 1 / 1.9) {
  const size = 512;
  const { canvas, context } = canvas2d(size, size);
  const w = size * ratio;
  const h = w / Math.max(0.2, aspect);
  const cx = size / 2;
  const cy = size / 2;
  const r = Math.min(w / 2, h * 0.9);
  const bottom = cy - h / 2;
  const path = () => {
    context.beginPath();
    context.moveTo(cx - w / 2, bottom);
    context.lineTo(cx + w / 2, bottom);
    context.lineTo(cx + w / 2, bottom + h - r);
    context.arc(cx, bottom + h - r, r, 0, Math.PI, false);
    context.closePath();
  };
  context.shadowColor = color;
  context.strokeStyle = color;
  context.globalCompositeOperation = "lighter";
  const passes = [
    [size * 0.09, 0.18, 46],
    [size * 0.045, 0.3, 30],
    [size * 0.016, 0.55, 18],
  ];
  passes.forEach(([lineWidth, alpha, blur]) => {
    context.globalAlpha = alpha;
    context.lineWidth = lineWidth;
    context.shadowBlur = blur;
    path();
    context.stroke();
  });
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  context.globalCompositeOperation = "source-over";
  return canvas;
}

export function paintFloor(color, glowColor) {
  const { canvas, context } = canvas2d(256, 256);
  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 176);
  gradient.addColorStop(0, glowColor);
  gradient.addColorStop(0.55, color);
  gradient.addColorStop(1, "#07060d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  // Faint tile lines give the 3D floor a sense of scale.
  context.strokeStyle = "rgba(255,255,255,0.09)";
  context.lineWidth = 1.5;
  for (let i = 1; i < 6; i += 1) {
    context.beginPath();
    context.moveTo((i * 256) / 6, 0);
    context.lineTo((i * 256) / 6, 256);
    context.stroke();
    context.beginPath();
    context.moveTo(0, (i * 256) / 6);
    context.lineTo(256, (i * 256) / 6);
    context.stroke();
  }
  return canvas;
}

export function paintSparkle(color) {
  const { canvas, context } = canvas2d(64, 64);
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.35, color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return canvas;
}

// Glowing glyph ring laid flat around the doorway.
export function paintGlyphs(color, seed = 11) {
  const random = randomFactory(seed);
  const { canvas, context } = canvas2d(512, 512);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineCap = "round";
  const count = 28;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 214 + (i % 3) * 12;
    const x = 256 + Math.cos(angle) * radius;
    const y = 256 + Math.sin(angle) * radius;
    context.save();
    context.translate(x, y);
    context.rotate(angle + Math.PI / 2);
    context.globalAlpha = 0.55 + random() * 0.45;
    context.lineWidth = 3.2;
    const kind = i % 4;
    context.beginPath();
    if (kind === 0) {
      context.moveTo(-7, -9);
      context.lineTo(0, 9);
      context.lineTo(7, -9);
    } else if (kind === 1) {
      context.arc(0, 0, 8, 0.2, Math.PI * 1.7);
    } else if (kind === 2) {
      context.moveTo(-8, 0);
      context.lineTo(8, 0);
      context.moveTo(0, -8);
      context.lineTo(0, 8);
    } else {
      context.moveTo(-6, 7);
      context.lineTo(0, -8);
      context.lineTo(6, 7);
      context.closePath();
    }
    context.stroke();
    context.restore();
  }
  context.globalAlpha = 1;
  return canvas;
}
