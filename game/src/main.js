// main.js — entry point for EMBERFALL: game loop, state machine and menus.
// Supports ?shot=title|play|boss|over|win to open a staged scene directly
// (used for the entry's screenshots).

import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  ARENA_W, ARENA_H, createWorld, startGame, updateWorld, buildShotScene, loadHigh, mulberry32,
} from './world.js';
import { render } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = shot ? 1337 : (Date.now() % 2147483647);
const rng = mulberry32(seed);

const world = createWorld(rng);
world.high = loadHigh();
const input = createInput(canvas);
const audio = createAudio();
if (shot) buildShotScene(world, shot);

function inButton(p, btn) {
  return btn && p.x >= btn.x && p.x <= btn.x + btn.w && p.y >= btn.y && p.y <= btn.y + btn.h;
}

function handleMenus() {
  const click = input.consumeClick();
  if (input.wasPressed('KeyM')) {
    world.muted = audio.toggleMute();
  }
  if (world.state === 'title') {
    if (input.wasPressed('Enter') || (click && inButton(click, world.uiButton))) {
      audio.unlock();
      startGame(world);
      audio.wave();
    }
    return;
  }
  if (world.state === 'playing') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      world.state = 'paused';
    }
    return;
  }
  if (world.state === 'paused') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape') || (click && true)) {
      world.state = 'playing';
    }
    return;
  }
  if (world.state === 'over' || world.state === 'win') {
    if (input.wasPressed('KeyR') || (click && inButton(click, world.uiButton))) {
      audio.unlock();
      startGame(world);
    }
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!shot) handleMenus();
  updateWorld(world, input, audio, dt);
  render(ctx, world);
  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
