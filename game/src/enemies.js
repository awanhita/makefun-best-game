// enemies.js — enemy types, wave composition, and enemy behaviour for EMBERFALL.
// An enemy is a plain object; updateEnemy moves it and lets it attack through
// the api passed in ({ player, fireEnemyBullet, time }).

export const ENEMY_TYPES = {
  chaser:   { hp: 1, speed: 100, radius: 16, score: 100, color: '#ff2d78', glow: '#ff2d78' },
  shooter:  { hp: 2, speed: 72,  radius: 16, score: 150, color: '#ffb020', glow: '#ffb020' },
  splitter: { hp: 3, speed: 56,  radius: 22, score: 200, color: '#39d0ff', glow: '#39d0ff' },
  dasher:   { hp: 2, speed: 84,  radius: 14, score: 200, color: '#b14bff', glow: '#b14bff' },
  mini:     { hp: 1, speed: 165, radius: 9,  score: 50,  color: '#39d0ff', glow: '#39d0ff' },
  boss:     { hp: 70, speed: 36, radius: 62, score: 2000, color: '#ff2244', glow: '#ff2244' },
};

// Which types may appear in a given wave, with spawn weights.
export function wavePool(wave) {
  const pool = [{ type: 'chaser', w: 10 }];
  if (wave >= 2) pool.push({ type: 'shooter', w: 6 });
  if (wave >= 3) pool.push({ type: 'splitter', w: 5 });
  if (wave >= 4) pool.push({ type: 'dasher', w: 5 });
  return pool;
}

// How many non-boss enemies a wave spawns.
export function waveCount(wave) {
  return 6 + wave * 2;
}

export function makeEnemy(type, x, y, wave) {
  const def = ENEMY_TYPES[type];
  const hpBonus = type === 'boss' ? wave * 6 : Math.floor(wave / 3);
  return {
    type,
    x, y,
    vx: 0, vy: 0,
    r: def.radius,
    hp: def.hp + hpBonus,
    maxHp: def.hp + hpBonus,
    speed: def.speed + Math.min(40, wave * 4),
    score: def.score,
    color: def.color,
    glow: def.glow,
    angle: 0,
    t: Math.random() * 6.28,
    fireCd: 1 + Math.random(),
    dashState: 'roam',
    dashTimer: 1.5 + Math.random(),
    dashX: 0, dashY: 0,
    attackCd: 2.2,
    burstCd: 3.0,
    flash: 0,
    rot: 0,
  };
}

export function makeBoss(x, y, wave) {
  const boss = makeEnemy('boss', x, y, wave);
  boss.r = 62;
  return boss;
}

function pickType(pool, rng) {
  let total = 0;
  for (const p of pool) total += p.w;
  let roll = rng() * total;
  for (const p of pool) {
    roll -= p.w;
    if (roll <= 0) return p.type;
  }
  return pool[0].type;
}

// Build the spawn queue for a wave: a list of { type, delay } entries.
// Boss waves (every 5th) spawn the boss first plus a small escort.
export function buildWaveQueue(wave, rng) {
  const queue = [];
  if (wave % 5 === 0) {
    queue.push({ type: 'boss', delay: 0.4 });
    for (let i = 0; i < 4; i++) queue.push({ type: 'chaser', delay: 1.2 + i * 0.9 });
    return queue;
  }
  const pool = wavePool(wave);
  const n = waveCount(wave);
  for (let i = 0; i < n; i++) {
    queue.push({ type: pickType(pool, rng), delay: 0.3 + i * 0.55 });
  }
  return queue;
}

// Pick a spawn point on the arena edge, away from the player.
export function spawnPoint(rng, w, h, player) {
  for (let tries = 0; tries < 12; tries++) {
    const side = Math.floor(rng() * 4);
    let x, y;
    const m = 30;
    if (side === 0) { x = m + rng() * (w - 2 * m); y = m; }
    else if (side === 1) { x = m + rng() * (w - 2 * m); y = h - m; }
    else if (side === 2) { x = m; y = m + rng() * (h - 2 * m); }
    else { x = w - m; y = m + rng() * (h - 2 * m); }
    const dx = x - player.x;
    const dy = y - player.y;
    if (dx * dx + dy * dy > 320 * 320) return { x, y };
  }
  return { x: 40, y: 40 };
}

function moveToward(e, tx, ty, speed, dt) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.vx = (dx / d) * speed;
  e.vy = (dy / d) * speed;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.angle = Math.atan2(dy, dx);
}

// Per-type behaviour. api: { player, fireEnemyBullet(x, y, angle, speed), time }.
export function updateEnemy(e, dt, api) {
  const p = api.player;
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;

  if (e.type === 'chaser' || e.type === 'mini') {
    moveToward(e, p.x, p.y, e.speed, dt);
  } else if (e.type === 'shooter') {
    // Keep a firing distance, strafe sideways, shoot at the player.
    const want = 270;
    const radial = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
    const strafe = Math.sin(e.t * 1.7) * 0.9;
    const nx = dx / dist;
    const ny = dy / dist;
    const px = -ny;
    const py = nx;
    e.vx = (nx * radial + px * strafe) * e.speed;
    e.vy = (ny * radial + py * strafe) * e.speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.angle = Math.atan2(dy, dx);
    e.fireCd -= dt;
    if (e.fireCd <= 0 && dist < 560) {
      e.fireCd = 1.5 + Math.random() * 0.5;
      api.fireEnemyBullet(e.x, e.y, Math.atan2(dy, dx), 265);
    }
  } else if (e.type === 'splitter') {
    // Slow drift with a sine wobble.
    const wob = Math.sin(e.t * 2.2) * 0.6;
    const nx = dx / dist;
    const ny = dy / dist;
    e.vx = (nx + -ny * wob) * e.speed;
    e.vy = (ny + nx * wob) * e.speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.angle = Math.atan2(dy, dx);
    e.rot += dt * 0.8;
  } else if (e.type === 'dasher') {
    e.dashTimer -= dt;
    if (e.dashState === 'roam') {
      moveToward(e, p.x, p.y, e.speed * 0.7, dt);
      if (e.dashTimer <= 0) {
        e.dashState = 'aim';
        e.dashTimer = 0.45;
      }
    } else if (e.dashState === 'aim') {
      // Telegraph: hold still, flashing, locked on the player's spot.
      e.dashX = p.x;
      e.dashY = p.y;
      e.vx = 0;
      e.vy = 0;
      if (e.dashTimer <= 0) {
        e.dashState = 'dash';
        e.dashTimer = 0.38;
      }
    } else {
      moveToward(e, e.dashX, e.dashY, 540, dt);
      if (e.dashTimer <= 0) {
        e.dashState = 'roam';
        e.dashTimer = 1.8 + Math.random() * 1.2;
      }
    }
  } else if (e.type === 'boss') {
    const enraged = e.hp < e.maxHp * 0.3;
    const speed = enraged ? e.speed * 1.7 : e.speed;
    // Hover toward a point above the player, never too close.
    const tx = p.x;
    const ty = Math.max(150, p.y - 240);
    moveToward(e, tx, ty, speed, dt);
    e.rot += dt * 0.4;
    e.burstCd -= dt;
    e.attackCd -= dt;
    if (e.burstCd <= 0) {
      e.burstCd = enraged ? 2.0 : 2.9;
      const n = 12;
      for (let i = 0; i < n; i++) {
        api.fireEnemyBullet(e.x, e.y, (i / n) * Math.PI * 2 + e.t, 190);
      }
      api.onBossBurst();
    }
    if (e.attackCd <= 0) {
      e.attackCd = enraged ? 0.9 : 1.4;
      const base = Math.atan2(dy, dx);
      for (const off of [-0.22, 0, 0.22]) {
        api.fireEnemyBullet(e.x, e.y, base + off, 300);
      }
      api.onBossShot();
    }
  }

  // Keep inside the arena.
  e.x = Math.max(e.r, Math.min(1280 - e.r, e.x));
  e.y = Math.max(e.r + 44, Math.min(800 - e.r, e.y));
}
