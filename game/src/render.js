// render.js — all drawing for EMBERFALL: arena, entities, HUD and screens.
// Draws only from the world object; holds no game logic.

import { ARENA_W, ARENA_H, WIN_WAVE } from './world.js';

const NEON = {
  bg0: '#050510',
  bg1: '#0b1030',
  player: '#5df2ff',
  playerCore: '#e8feff',
  bullet: '#ffe066',
  enemyBullet: '#ff5d5d',
  text: '#e8ecff',
  dim: '#8a93c9',
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glowText(ctx, str, x, y, size, color, font, align) {
  ctx.save();
  ctx.font = font || ('700 ' + size + 'px Verdana, sans-serif');
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.85;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function drawBackground(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, ARENA_H);
  g.addColorStop(0, NEON.bg1);
  g.addColorStop(0.55, NEON.bg0);
  g.addColorStop(1, '#12081f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);

  // Soft nebula blobs.
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (const [x, y, r, c] of [
    [220, 180, 260, '#3b2d8f'],
    [1050, 300, 300, '#7a1e5e'],
    [640, 700, 280, '#123a6b'],
  ]) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();

  // Twinkling starfield.
  for (const s of world.stars) {
    const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(s.tw * 2));
    ctx.globalAlpha = a * s.z;
    ctx.fillStyle = '#cfe6ff';
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  // Arena frame.
  ctx.save();
  ctx.strokeStyle = 'rgba(93, 242, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 50, ARENA_W - 12, ARENA_H - 56);
  ctx.restore();
}

function drawPlayer(ctx, world) {
  const p = world.player;
  if (!p.alive) return;
  if (p.invuln > 0 && Math.floor(world.time * 14) % 2 === 0) return; // blink while invulnerable
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = NEON.player;
  ctx.shadowBlur = 22;
  // Ship: a sleek arrow-orb.
  ctx.rotate(p.aim);
  const grad = ctx.createLinearGradient(-14, 0, 18, 0);
  grad.addColorStop(0, '#0e7d9e');
  grad.addColorStop(0.6, NEON.player);
  grad.addColorStop(1, NEON.playerCore);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = NEON.playerCore;
  ctx.beginPath();
  ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (p.shield) {
    ctx.save();
    ctx.strokeStyle = 'rgba(57, 208, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#39d0ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 10 + Math.sin(world.time * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (p.rapid > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 176, 32, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 5, -Math.PI / 2, -Math.PI / 2 + (p.rapid / 8) * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemies(ctx, world) {
  for (const e of world.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.flash > 0;
    ctx.shadowColor = e.glow;
    ctx.shadowBlur = flash ? 26 : 14;
    ctx.fillStyle = flash ? '#ffffff' : e.color;
    ctx.strokeStyle = flash ? '#ffffff' : e.color;
    ctx.lineWidth = 2;
    if (e.type === 'chaser' || e.type === 'mini') {
      // Spiked diamond.
      ctx.rotate(e.angle);
      ctx.beginPath();
      ctx.moveTo(e.r + 4, 0);
      ctx.lineTo(0, -e.r * 0.7);
      ctx.lineTo(-e.r - 4, 0);
      ctx.lineTo(0, e.r * 0.7);
      ctx.closePath();
      ctx.fill();
    } else if (e.type === 'shooter') {
      // Hex turret with barrel.
      ctx.rotate(e.angle);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * e.r;
        const py = Math.sin(a) * e.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1a1206';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(e.r + 10, 0);
      ctx.stroke();
    } else if (e.type === 'splitter') {
      // Segmented orb, slowly rotating.
      ctx.rotate(e.rot);
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(5, 10, 30, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-e.r, 0);
      ctx.lineTo(e.r, 0);
      ctx.moveTo(0, -e.r);
      ctx.lineTo(0, e.r);
      ctx.stroke();
      ctx.fillStyle = '#062a3a';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'dasher') {
      // Arrowhead; flashes white while aiming.
      ctx.rotate(e.angle);
      if (e.dashState === 'aim') {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(world.time * 30);
        ctx.fillStyle = '#ffffff';
      }
      ctx.beginPath();
      ctx.moveTo(e.r + 6, 0);
      ctx.lineTo(-e.r, -e.r * 0.8);
      ctx.lineTo(-e.r * 0.4, 0);
      ctx.lineTo(-e.r, e.r * 0.8);
      ctx.closePath();
      ctx.fill();
    } else if (e.type === 'boss') {
      // Great ember beast: ringed core with orbiting spikes.
      ctx.rotate(e.rot * 0.5);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rad = i % 2 === 0 ? e.r + 12 : e.r - 6;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-e.rot * 0.5);
      ctx.fillStyle = '#2b0208';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.22 + Math.sin(world.time * 6) * 3, 0, Math.PI * 2);
      ctx.fill();
      // Boss health arc.
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ff2244';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 20, -Math.PI / 2, -Math.PI / 2 + (e.hp / e.maxHp) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawBullets(ctx, world) {
  for (const b of world.bullets) {
    ctx.save();
    ctx.shadowColor = NEON.bullet;
    ctx.shadowBlur = 10;
    ctx.fillStyle = NEON.bullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const b of world.enemyBullets) {
    ctx.save();
    ctx.shadowColor = NEON.enemyBullet;
    ctx.shadowBlur = 12;
    ctx.fillStyle = NEON.enemyBullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd7d7';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPickups(ctx, world) {
  for (const pk of world.pickups) {
    const bob = Math.sin(pk.t * 4) * 3;
    const blink = pk.life < 3 ? (Math.floor(world.time * 6) % 2 === 0 ? 0.35 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(pk.x, pk.y + bob);
    ctx.shadowBlur = 16;
    if (pk.type === 'shield') {
      ctx.shadowColor = '#39d0ff';
      ctx.strokeStyle = '#39d0ff';
      ctx.fillStyle = '#0a2e44';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, pk.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9beaff';
      ctx.font = '700 13px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', 0, 1);
    } else if (pk.type === 'rapid') {
      ctx.shadowColor = '#ffb020';
      ctx.fillStyle = '#ffb020';
      ctx.beginPath();
      ctx.moveTo(2, -13);
      ctx.lineTo(-7, 1);
      ctx.lineTo(-1, 1);
      ctx.lineTo(-3, 13);
      ctx.lineTo(8, -2);
      ctx.lineTo(1, -2);
      ctx.closePath();
      ctx.fill();
    } else if (pk.type === 'bomb') {
      ctx.shadowColor = '#ff9d00';
      ctx.fillStyle = '#ff9d00';
      ctx.beginPath();
      ctx.arc(0, 0, pk.r - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff9d00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, -9);
      ctx.quadraticCurveTo(14, -16, 10, -20);
      ctx.stroke();
    } else {
      ctx.shadowColor = '#ff5d8f';
      ctx.fillStyle = '#ff5d8f';
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.bezierCurveTo(-14, -2, -10, -13, 0, -6);
      ctx.bezierCurveTo(10, -13, 14, -2, 0, 10);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawParticles(ctx, world) {
  for (const pt of world.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const t of world.texts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, t.life / t.max);
    ctx.font = '700 ' + t.size + 'px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, t.x, t.y);
    ctx.restore();
  }
}

function drawHud(ctx, world) {
  ctx.save();
  ctx.textBaseline = 'middle';
  // Score, top left.
  ctx.textAlign = 'left';
  ctx.font = '700 26px Verdana, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#5df2ff';
  ctx.shadowBlur = 8;
  ctx.fillText('SCORE ' + world.score.toLocaleString('en-US'), 22, 24);
  ctx.shadowBlur = 0;
  ctx.font = '600 13px Verdana, sans-serif';
  ctx.fillStyle = NEON.dim;
  ctx.fillText('BEST ' + world.high.toLocaleString('en-US'), 22, 46);
  if (world.mult > 1) {
    ctx.font = '700 17px Verdana, sans-serif';
    ctx.fillStyle = '#ffb020';
    ctx.shadowColor = '#ffb020';
    ctx.shadowBlur = 8;
    ctx.fillText('COMBO x' + world.mult + '  (' + world.combo + ')', 22, 70);
    ctx.shadowBlur = 0;
    // Combo timer bar.
    ctx.fillStyle = 'rgba(255, 176, 32, 0.3)';
    ctx.fillRect(22, 80, 120, 5);
    ctx.fillStyle = '#ffb020';
    ctx.fillRect(22, 80, 120 * Math.max(0, world.comboTimer / 4), 5);
  }
  // Wave, top center.
  ctx.textAlign = 'center';
  ctx.font = '700 22px Verdana, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('WAVE ' + Math.max(1, world.wave) + ' / ' + WIN_WAVE, ARENA_W / 2, 24);
  ctx.font = '600 13px Verdana, sans-serif';
  ctx.fillStyle = NEON.dim;
  const left = world.enemies.length + world.spawnQueue.length;
  ctx.fillText(world.waveState === 'fighting' ? left + ' hostiles left' : 'clear the wave', ARENA_W / 2, 46);
  // Lives, top right.
  ctx.textAlign = 'right';
  for (let i = 0; i < 3; i++) {
    const x = ARENA_W - 30 - i * 34;
    const y = 24;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = i < world.lives ? '#ff5d8f' : 'rgba(255, 93, 143, 0.18)';
    ctx.shadowColor = '#ff5d8f';
    ctx.shadowBlur = i < world.lives ? 10 : 0;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-11, -1, -8, -10, 0, -5);
    ctx.bezierCurveTo(8, -10, 11, -1, 0, 8);
    ctx.fill();
    ctx.restore();
  }
  ctx.font = '600 13px Verdana, sans-serif';
  ctx.fillStyle = world.player.shield ? '#39d0ff' : NEON.dim;
  ctx.fillText(world.player.shield ? 'SHIELD READY' : 'NO SHIELD', ARENA_W - 22, 46);
  if (world.player.rapid > 0) {
    ctx.fillStyle = '#ffb020';
    ctx.fillText('RAPID ' + world.player.rapid.toFixed(1) + 's', ARENA_W - 22, 68);
  }
  ctx.fillStyle = world.muted ? '#ff5d5d' : NEON.dim;
  ctx.fillText(world.muted ? 'MUTED (M)' : 'M mute · P pause', ARENA_W - 22, 88);
  // Boss bar.
  if (world.boss && world.boss.hp > 0) {
    const bw = 520;
    const bx = (ARENA_W - bw) / 2;
    const by = 62;
    ctx.textAlign = 'center';
    ctx.font = '700 14px Verdana, sans-serif';
    ctx.fillStyle = '#ff5d7a';
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 8;
    ctx.fillText('EMBER BEAST', ARENA_W / 2, by + 22);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 34, 68, 0.25)';
    rr(ctx, bx, by + 32, bw, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#ff2244';
    rr(ctx, bx, by + 32, bw * Math.max(0, world.boss.hp / world.boss.maxHp), 12, 6);
    ctx.fill();
  }
  ctx.restore();

  // Wave banner.
  if (world.bannerTimer > 0 && world.banner) {
    const a = Math.min(1, world.bannerTimer * 2);
    ctx.save();
    ctx.globalAlpha = a;
    glowText(ctx, world.banner, ARENA_W / 2, 250, 44, '#5df2ff', '800 44px Verdana, sans-serif');
    if (world.bannerSub) {
      ctx.font = '600 17px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = NEON.text;
      ctx.fillText(world.bannerSub, ARENA_W / 2, 292);
    }
    ctx.restore();
  }
}

function drawButton(ctx, x, y, w, h, label) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, '#0e7d9e');
  g.addColorStop(1, '#b14bff');
  ctx.shadowColor = '#5df2ff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = g;
  rr(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, 12);
  ctx.stroke();
  ctx.font = '800 24px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
  return { x, y, w, h };
}

function drawTitle(ctx, world) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 4, 16, 0.55)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  const pulse = 1 + Math.sin(world.time * 2.2) * 0.02;
  ctx.translate(ARENA_W / 2, 215);
  ctx.scale(pulse, pulse);
  ctx.translate(-ARENA_W / 2, -215);
  const g = ctx.createLinearGradient(240, 0, 1040, 0);
  g.addColorStop(0, '#ff2d78');
  g.addColorStop(0.5, '#ffb020');
  g.addColorStop(1, '#5df2ff');
  ctx.save();
  ctx.font = '800 96px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff2d78';
  ctx.shadowBlur = 34;
  ctx.fillStyle = g;
  ctx.fillText('EMBERFALL', ARENA_W / 2, 215);
  ctx.restore();
  glowText(ctx, 'A NEON ARENA SURVIVAL', ARENA_W / 2, 285, 21, '#5df2ff', '700 21px Verdana, sans-serif');
  ctx.restore();

  ctx.save();
  ctx.font = '600 16px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = NEON.text;
  const lines = [
    'Survive 10 waves of ember beasts. Beat the Wave 10 boss to win.',
    'WASD / Arrows — move      Mouse — aim      Click / Space — shoot',
    'P — pause      M — mute      Grab pickups: shield, rapid fire, nova bomb, heart',
  ];
  lines.forEach((line, i) => ctx.fillText(line, ARENA_W / 2, 350 + i * 28));
  ctx.restore();

  const btn = drawButton(ctx, ARENA_W / 2 - 130, 470, 260, 62, '▶  START');
  world.uiButton = btn;
  ctx.save();
  ctx.font = '600 15px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = NEON.dim;
  ctx.fillText('or press Enter', ARENA_W / 2, 556);
  if (world.high > 0) {
    ctx.font = '700 19px Verdana, sans-serif';
    ctx.fillStyle = '#ffb020';
    ctx.fillText('BEST SCORE  ' + world.high.toLocaleString('en-US'), ARENA_W / 2, 600);
  } else {
    ctx.font = '600 16px Verdana, sans-serif';
    ctx.fillStyle = NEON.dim;
    ctx.fillText('No runs yet — set the first best score.', ARENA_W / 2, 600);
  }
  ctx.restore();
}

function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 4, 16, 0.6)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  glowText(ctx, 'PAUSED', ARENA_W / 2, 360, 54, '#5df2ff', '800 54px Verdana, sans-serif');
  ctx.font = '600 18px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = NEON.text;
  ctx.fillText('Press P or Esc to resume', ARENA_W / 2, 430);
  ctx.restore();
}

function drawEnd(ctx, world, win) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 4, 16, 0.62)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  if (win) {
    glowText(ctx, 'VICTORY', ARENA_W / 2, 250, 72, '#ffb020', '800 72px Verdana, sans-serif');
    glowText(ctx, 'THE EMBERFALL IS CLEARED', ARENA_W / 2, 320, 22, '#5df2ff', '700 22px Verdana, sans-serif');
  } else {
    glowText(ctx, 'GAME OVER', ARENA_W / 2, 250, 72, '#ff2d78', '800 72px Verdana, sans-serif');
    glowText(ctx, 'The embers got you this time', ARENA_W / 2, 320, 22, '#8a93c9', '700 22px Verdana, sans-serif');
  }
  ctx.font = '700 30px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('SCORE  ' + world.score.toLocaleString('en-US'), ARENA_W / 2, 400);
  ctx.font = '600 18px Verdana, sans-serif';
  ctx.fillStyle = NEON.text;
  ctx.fillText('Wave reached: ' + world.wave + '  ·  Kills: ' + world.kills, ARENA_W / 2, 444);
  ctx.fillStyle = '#ffb020';
  ctx.font = '700 18px Verdana, sans-serif';
  ctx.fillText('BEST  ' + world.high.toLocaleString('en-US'), ARENA_W / 2, 476);
  const btn = drawButton(ctx, ARENA_W / 2 - 130, 520, 260, 62, '↻  PLAY AGAIN');
  world.uiButton = btn;
  ctx.font = '600 15px Verdana, sans-serif';
  ctx.fillStyle = NEON.dim;
  ctx.fillText('or press R', ARENA_W / 2, 606);
  ctx.restore();
}

export function render(ctx, world) {
  ctx.save();
  if (world.shake > 0) {
    const s = world.shake * world.shake * 14;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground(ctx, world);
  if (world.state === 'title') {
    drawParticles(ctx, world);
    drawTitle(ctx, world);
  } else {
    drawPickups(ctx, world);
    drawEnemies(ctx, world);
    drawPlayer(ctx, world);
    drawBullets(ctx, world);
    drawParticles(ctx, world);
    drawHud(ctx, world);
    if (world.state === 'paused') drawPause(ctx);
    else if (world.state === 'over') drawEnd(ctx, world, false);
    else if (world.state === 'win') drawEnd(ctx, world, true);
  }
  ctx.restore();
  if (world.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.55, world.flash);
    ctx.fillStyle = world.flashColor;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.restore();
  }
}
