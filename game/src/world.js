// world.js — game state, update loop, collisions, pickups, waves and scoring.
// Owns every entity: player, bullets, enemies, particles, pickups, floating texts.

import { makeEnemy, makeBoss, buildWaveQueue, spawnPoint, updateEnemy } from './enemies.js';

export const ARENA_W = 1280;
export const ARENA_H = 800;
export const WIN_WAVE = 10;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWorld(rng) {
  const stars = [];
  for (let i = 0; i < 130; i++) {
    stars.push({
      x: rng() * ARENA_W,
      y: rng() * ARENA_H,
      z: 0.25 + rng() * 0.75,
      s: 0.6 + rng() * 1.8,
      tw: rng() * 6.28,
    });
  }
  return {
    rng,
    state: 'title', // title | playing | paused | over | win
    time: 0,
    score: 0,
    high: 0,
    combo: 0,
    comboTimer: 0,
    mult: 1,
    lives: 3,
    wave: 0,
    kills: 0,
    shake: 0,
    flash: 0,
    flashColor: '#ffffff',
    player: freshPlayer(),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    pickups: [],
    texts: [],
    stars,
    waveState: 'idle', // idle | fighting | clear
    waveTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    boss: null,
    banner: '',
    bannerTimer: 0,
    bannerSub: '',
    muted: false,
    shotMode: null,
  };
}

function freshPlayer() {
  return {
    x: ARENA_W / 2, y: ARENA_H - 180,
    vx: 0, vy: 0, r: 14,
    aim: -Math.PI / 2,
    fireCd: 0,
    invuln: 0,
    shield: false,
    rapid: 0,
    alive: true,
    thrust: 0,
  };
}

export function startGame(world) {
  const keepStars = world.stars;
  const keepHigh = world.high;
  const keepRng = world.rng;
  const fresh = createWorld(keepRng);
  fresh.stars = keepStars;
  fresh.high = keepHigh;
  fresh.rng = keepRng;
  fresh.shotMode = world.shotMode;
  Object.keys(world).forEach((k) => delete world[k]);
  Object.assign(world, fresh);
  world.state = 'playing';
  world.waveState = 'idle';
  world.waveTimer = 1.2;
  world.banner = 'GET READY';
  world.bannerSub = 'Wave 1 incoming — survive the ember storm';
  world.bannerTimer = 1.6;
}

function nextWave(world) {
  world.wave += 1;
  world.spawnQueue = buildWaveQueue(world.wave, world.rng);
  world.spawnTimer = 0.2;
  world.waveState = 'fighting';
  const isBoss = world.wave % 5 === 0;
  world.banner = isBoss ? 'WARNING — BOSS WAVE ' + world.wave : 'WAVE ' + world.wave;
  world.bannerSub = isBoss ? 'A huge ember beast approaches' : waveTip(world.wave);
  world.bannerTimer = 2.0;
}

function waveTip(wave) {
  if (wave === 2) return 'Shooters keep their distance — close in fast';
  if (wave === 3) return 'Splitters break apart — watch the minis';
  if (wave === 4) return 'Dashers telegraph, then charge';
  if (wave === 6) return 'The storm thickens — grab pickups';
  if (wave === 8) return 'Two waves to the final boss';
  return 'Survive the ember storm';
}

function addText(world, x, y, str, color, size) {
  world.texts.push({ x, y, str, color: color || '#ffffff', size: size || 15, life: 0.9, max: 0.9 });
}

function burst(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = world.rng() * Math.PI * 2;
    const sp = (0.3 + world.rng() * 0.7) * speed;
    world.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + world.rng() * 0.5,
      max: 0.9,
      size: 1.5 + world.rng() * 3,
      color,
      drag: 0.92,
    });
  }
}

function dropPickup(world, x, y, forceType) {
  const roll = world.rng();
  let type = forceType;
  if (!type) {
    if (roll < 0.3) type = 'shield';
    else if (roll < 0.55) type = 'rapid';
    else if (roll < 0.78) type = 'bomb';
    else type = 'heart';
  }
  world.pickups.push({
    x, y,
    vx: (world.rng() - 0.5) * 40,
    vy: 26 + world.rng() * 20,
    r: 13,
    type,
    life: 12,
    t: world.rng() * 6.28,
  });
}

function applyPickup(world, type, audio) {
  const p = world.player;
  if (type === 'shield') {
    p.shield = true;
    addText(world, p.x, p.y - 26, 'SHIELD UP', '#39d0ff', 17);
  } else if (type === 'rapid') {
    p.rapid = 8;
    addText(world, p.x, p.y - 26, 'RAPID FIRE', '#ffb020', 17);
  } else if (type === 'bomb') {
    addText(world, p.x, p.y - 26, 'NOVA BOMB', '#ff9d00', 19);
    detonateBomb(world, audio);
  } else if (type === 'heart') {
    if (world.lives < 3) {
      world.lives += 1;
      addText(world, p.x, p.y - 26, '+1 LIFE', '#ff5d8f', 17);
    } else {
      world.score += 250 * world.mult;
      addText(world, p.x, p.y - 26, '+250', '#ff5d8f', 17);
    }
  }
  audio.pickup();
}

function detonateBomb(world, audio) {
  world.flash = 0.35;
  world.flashColor = '#ffdf6b';
  world.shake = Math.min(1, world.shake + 0.8);
  burst(world, world.player.x, world.player.y, '#ffdf6b', 60, 520);
  const survivors = [];
  for (const e of world.enemies) {
    if (e.type === 'boss') {
      e.hp -= 25;
      e.flash = 0.25;
      addText(world, e.x, e.y - 70, '-25', '#ffdf6b', 18);
    } else {
      e.hp = 0;
      killEnemy(world, e, audio, true);
    }
    if (e.hp > 0) survivors.push(e);
  }
  world.enemies = survivors;
  world.enemyBullets = [];
  audio.bomb();
}

function killEnemy(world, e, audio, byBomb) {
  world.kills += 1;
  world.combo += 1;
  world.comboTimer = 4;
  world.mult = Math.min(5, 1 + Math.floor(world.combo / 5));
  const gained = e.score * world.mult;
  world.score += gained;
  addText(world, e.x, e.y, '+' + gained, '#ffe066', e.type === 'boss' ? 22 : 15);
  burst(world, e.x, e.y, e.color, e.type === 'boss' ? 90 : 18, e.type === 'boss' ? 460 : 300);
  if (e.type === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const mini = makeEnemy('mini', e.x + (i === 0 ? -14 : 14), e.y, world.wave);
      mini.vx = (i === 0 ? -1 : 1) * 120;
      world.enemies.push(mini);
    }
  }
  if (e.type === 'boss') {
    world.boss = null;
    dropPickup(world, e.x - 40, e.y, 'heart');
    dropPickup(world, e.x + 40, e.y, 'bomb');
    world.shake = 1;
    world.flash = 0.3;
    world.flashColor = '#ffffff';
    audio.bossBoom();
    if (world.wave >= WIN_WAVE) {
      winGame(world, audio);
      return;
    }
  } else {
    audio.boom();
    if (!byBomb && world.rng() < 0.16) dropPickup(world, e.x, e.y);
  }
}

function hurtPlayer(world, audio) {
  const p = world.player;
  if (p.invuln > 0 || world.state !== 'playing') return;
  if (p.shield) {
    p.shield = false;
    p.invuln = 1.2;
    world.combo = 0;
    world.mult = 1;
    addText(world, p.x, p.y - 26, 'SHIELD DOWN', '#39d0ff', 16);
    burst(world, p.x, p.y, '#39d0ff', 22, 320);
    world.shake = Math.min(1, world.shake + 0.5);
    audio.hit();
    return;
  }
  world.lives -= 1;
  world.combo = 0;
  world.mult = 1;
  p.invuln = 1.8;
  world.shake = 1;
  world.flash = 0.3;
  world.flashColor = '#ff2244';
  burst(world, p.x, p.y, '#ff5d8f', 40, 420);
  audio.hit();
  if (world.lives <= 0) {
    p.alive = false;
    burst(world, p.x, p.y, '#ffffff', 90, 520);
    world.state = 'over';
    if (world.score > world.high) world.high = world.score;
    saveHigh(world.high);
    audio.gameOver();
  }
}

function winGame(world, audio) {
  world.state = 'win';
  if (world.score > world.high) world.high = world.score;
  saveHigh(world.high);
  audio.win();
}

function saveHigh(v) {
  try {
    window.localStorage.setItem('emberfall_high', String(v));
  } catch (e) { /* storage unavailable — ignore */ }
}

export function loadHigh() {
  try {
    return parseInt(window.localStorage.getItem('emberfall_high') || '0', 10) || 0;
  } catch (e) {
    return 0;
  }
}

function updatePlayer(world, input, audio, dt) {
  const p = world.player;
  if (!p.alive) return;
  let ax = 0;
  let ay = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) ay -= 1;
  if (input.down('KeyS') || input.down('ArrowDown')) ay += 1;
  if (input.down('KeyA') || input.down('ArrowLeft')) ax -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) ax += 1;
  const len = Math.hypot(ax, ay) || 1;
  const speed = 350;
  p.vx = (ax / len) * speed;
  p.vy = (ay / len) * speed;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = Math.max(p.r + 4, Math.min(ARENA_W - p.r - 4, p.x));
  p.y = Math.max(p.r + 52, Math.min(ARENA_H - p.r - 4, p.y));
  p.aim = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
  p.thrust = (ax !== 0 || ay !== 0) ? 1 : 0;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.rapid > 0) p.rapid -= dt;

  const firing = input.mouse.down || input.down('Space');
  p.fireCd -= dt;
  if (firing && p.fireCd <= 0) {
    p.fireCd = p.rapid > 0 ? 0.062 : 0.125;
    const spread = 0.05;
    for (const off of [-spread, spread]) {
      const a = p.aim + off;
      world.bullets.push({
        x: p.x + Math.cos(a) * (p.r + 6),
        y: p.y + Math.sin(a) * (p.r + 6),
        vx: Math.cos(a) * 760,
        vy: Math.sin(a) * 760,
        r: 4,
        life: 0.9,
      });
    }
    burst(world, p.x + Math.cos(p.aim) * (p.r + 4), p.y + Math.sin(p.aim) * (p.r + 4), '#ffe066', 2, 120);
    audio.shoot();
  }
  if (p.thrust) {
    const back = p.aim + Math.PI;
    world.particles.push({
      x: p.x + Math.cos(back) * p.r,
      y: p.y + Math.sin(back) * p.r,
      vx: Math.cos(back) * 60 + (world.rng() - 0.5) * 40,
      vy: Math.sin(back) * 60 + (world.rng() - 0.5) * 40,
      life: 0.3, max: 0.3,
      size: 2 + world.rng() * 2,
      color: '#39d0ff',
      drag: 0.95,
    });
  }
}

function updateBullets(world, audio, dt) {
  const api = {
    player: world.player,
    fireEnemyBullet(x, y, angle, speed) {
      world.enemyBullets.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 5, life: 4,
      });
    },
    onBossBurst() { audio.enemyShoot(); },
    onBossShot() { audio.enemyShoot(); },
    time: world.time,
  };

  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  world.bullets = world.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < ARENA_W + 20 && b.y > -20 && b.y < ARENA_H + 20);

  for (const b of world.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  world.enemyBullets = world.enemyBullets.filter((b) => b.life > 0 && b.x > -20 && b.x < ARENA_W + 20 && b.y > 40 && b.y < ARENA_H + 20);

  for (const e of world.enemies) updateEnemy(e, dt, api);
  return api;
}

function collide(world, audio, dt) {
  const p = world.player;
  // Player bullets vs enemies.
  for (const b of world.bullets) {
    for (const e of world.enemies) {
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      const rr = b.r + e.r;
      if (dx * dx + dy * dy < rr * rr) {
        b.life = 0;
        e.hp -= 1;
        e.flash = 0.08;
        burst(world, b.x, b.y, e.color, 4, 160);
        if (e.hp <= 0) {
          e.hp = 0;
          killEnemy(world, e, audio, false);
        }
        break;
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
  world.enemies = world.enemies.filter((e) => e.hp > 0);

  if (world.state !== 'playing' || !p.alive) return;

  // Enemy bullets vs player.
  for (const b of world.enemyBullets) {
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const rr = b.r + p.r - 3;
    if (dx * dx + dy * dy < rr * rr) {
      b.life = 0;
      hurtPlayer(world, audio);
      if (world.state !== 'playing') return;
    }
  }
  world.enemyBullets = world.enemyBullets.filter((b) => b.life > 0);

  // Enemies touching the player.
  for (const e of world.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const rr = e.r + p.r - 2;
    if (dx * dx + dy * dy < rr * rr) {
      if (e.type !== 'boss') {
        e.hp = 0;
        killEnemy(world, e, audio, false);
        world.enemies = world.enemies.filter((x) => x.hp > 0);
      }
      hurtPlayer(world, audio);
      if (world.state !== 'playing') return;
    }
  }

  // Pickups vs player (magnet + collect).
  for (const pk of world.pickups) {
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 110) {
      pk.vx += (dx / d) * 320 * dt;
      pk.vy += (dy / d) * 320 * dt;
    }
    if (d < p.r + pk.r + 4) {
      pk.life = 0;
      applyPickup(world, pk.type, audio);
    }
  }
  world.pickups = world.pickups.filter((pk) => pk.life > 0);
}

function updateFx(world, dt) {
  for (const pt of world.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= pt.drag;
    pt.vy *= pt.drag;
    pt.life -= dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);
  for (const t of world.texts) {
    t.y -= 42 * dt;
    t.life -= dt;
  }
  world.texts = world.texts.filter((t) => t.life > 0);
  for (const pk of world.pickups) {
    pk.t += dt;
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    pk.vy = Math.min(pk.vy, 46);
    pk.life -= dt;
  }
  world.pickups = world.pickups.filter((pk) => pk.life > 0);
  for (const s of world.stars) {
    s.y += s.z * 14 * dt;
    s.tw += dt;
    if (s.y > ARENA_H + 2) {
      s.y = -2;
      s.x = world.rng() * ARENA_W;
    }
  }
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 1.6);
  if (world.flash > 0) world.flash = Math.max(0, world.flash - dt * 1.4);
  if (world.bannerTimer > 0) world.bannerTimer -= dt;
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) {
      world.combo = 0;
      world.mult = 1;
    }
  }
}

export function updateWorld(world, input, audio, dt) {
  world.time += dt;
  updateFx(world, dt);
  if (world.state !== 'playing') return;

  updatePlayer(world, input, audio, dt);
  updateBullets(world, audio, dt);
  collide(world, audio, dt);
  if (world.state !== 'playing') return;

  // Wave flow.
  if (world.waveState === 'idle') {
    world.waveTimer -= dt;
    if (world.waveTimer <= 0) {
      nextWave(world);
      audio.wave();
    }
  } else if (world.waveState === 'fighting') {
    if (world.spawnQueue.length > 0) {
      world.spawnTimer -= dt;
      if (world.spawnTimer <= 0) {
        const next = world.spawnQueue.shift();
        const pt = spawnPoint(world.rng, ARENA_W, ARENA_H, world.player);
        const e = next.type === 'boss' ? makeBoss(pt.x, Math.max(140, pt.y), world.wave) : makeEnemy(next.type, pt.x, pt.y, world.wave);
        world.enemies.push(e);
        if (next.type === 'boss') world.boss = e;
        world.spawnTimer = next.delay;
      }
    } else if (world.enemies.length === 0) {
      world.waveState = 'clear';
      world.waveTimer = 2.0;
      world.banner = 'WAVE ' + world.wave + ' CLEAR';
      world.bannerSub = 'Bonus +' + 100 * world.wave * world.mult + ' — next wave incoming';
      world.bannerTimer = 2.0;
      world.score += 100 * world.wave * world.mult;
      if (world.lives < 3 && world.wave % 3 === 0) {
        world.lives += 1;
        addText(world, world.player.x, world.player.y - 30, '+1 LIFE', '#ff5d8f', 17);
      }
    }
  } else if (world.waveState === 'clear') {
    world.waveTimer -= dt;
    if (world.waveTimer <= 0) nextWave(world);
  }
}

// ---------------------------------------------------------------------------
// Staged scenes for screenshots (?shot=...). These build a fixed, lively
// frame so each screenshot shows its screen at its best.
// ---------------------------------------------------------------------------

function stagedEnemy(world, type, x, y) {
  const e = makeEnemy(type, x, y, world.wave);
  world.enemies.push(e);
  return e;
}

export function buildShotScene(world, shot) {
  world.shotMode = shot;
  if (shot === 'title') {
    world.state = 'title';
    world.high = 12450;
    return;
  }
  if (shot === 'over') {
    world.state = 'over';
    world.score = 4820;
    world.wave = 6;
    world.high = 12450;
    world.kills = 87;
    world.lives = 0;
    world.player.alive = false;
    return;
  }
  if (shot === 'win') {
    world.state = 'win';
    world.score = 9750;
    world.wave = 10;
    world.high = 12450;
    world.kills = 214;
    return;
  }
  if (shot === 'boss') {
    world.state = 'playing';
    world.wave = 5;
    world.waveState = 'fighting';
    world.score = 5100;
    world.combo = 18;
    world.mult = 4;
    world.comboTimer = 4;
    world.lives = 2;
    world.high = 12450;
    world.player.x = 640;
    world.player.y = 620;
    world.player.aim = -Math.PI / 2;
    world.player.shield = true;
    const boss = makeBoss(640, 215, 5);
    boss.hp = 42;
    world.enemies.push(boss);
    world.boss = boss;
    stagedEnemy(world, 'chaser', 300, 330);
    stagedEnemy(world, 'shooter', 980, 300);
    stagedEnemy(world, 'mini', 520, 430);
    for (let i = 0; i < 6; i++) {
      world.enemyBullets.push({
        x: 420 + i * 90, y: 300 + (i % 2) * 70,
        vx: (world.rng() - 0.5) * 60, vy: 220,
        r: 5, life: 3,
      });
    }
    burst(world, 700, 300, '#ff2244', 16, 260);
    addText(world, 700, 280, '+200', '#ffe066', 16);
    world.banner = 'WARNING — BOSS WAVE 5';
    world.bannerSub = 'A huge ember beast approaches';
    world.bannerTimer = 1.4;
    return;
  }
  // Default: 'play' — mid wave 3, full HUD, busy action.
  world.state = 'playing';
  world.wave = 3;
  world.waveState = 'fighting';
  world.score = 2350;
  world.combo = 12;
  world.mult = 3;
  world.comboTimer = 4;
  world.lives = 3;
  world.high = 12450;
  world.player.x = 470;
  world.player.y = 540;
  world.player.aim = -0.7;
  world.player.shield = true;
  world.player.rapid = 4.2;
  stagedEnemy(world, 'chaser', 760, 300);
  stagedEnemy(world, 'chaser', 900, 470);
  stagedEnemy(world, 'shooter', 1020, 240);
  stagedEnemy(world, 'splitter', 620, 210);
  stagedEnemy(world, 'dasher', 350, 300);
  stagedEnemy(world, 'mini', 830, 600);
  stagedEnemy(world, 'mini', 560, 660);
  for (let i = 0; i < 5; i++) {
    world.bullets.push({
      x: 520 + i * 46, y: 500 - i * 34,
      vx: 540, vy: -480,
      r: 4, life: 0.8,
    });
  }
  world.enemyBullets.push({ x: 980, y: 300, vx: -200, vy: 120, r: 5, life: 3 });
  world.pickups.push({ x: 760, y: 620, vx: 0, vy: 30, r: 13, type: 'rapid', life: 11, t: 1 });
  burst(world, 760, 300, '#ff2d78', 18, 300);
  burst(world, 620, 210, '#39d0ff', 10, 200);
  addText(world, 760, 280, '+300', '#ffe066', 16);
  addText(world, 620, 190, 'COMBO x3', '#ffb020', 15);
}
