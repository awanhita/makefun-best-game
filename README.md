# EMBERFALL — Neon Arena Survival

A complete original 2D arena survival shooter in vanilla JavaScript and canvas.
No libraries, no build step, no network requests — just static files.

## The game

You are a lone ember-orb holding the line against waves of ember beasts.
Survive 10 waves and defeat the Wave 10 boss to win. You have 3 lives.

**Enemies**

- **Chaser** — hunts you down.
- **Shooter** — keeps its distance and fires aimed shots.
- **Splitter** — slow and tough; breaks into two minis when killed.
- **Dasher** — telegraphs, then charges at high speed.
- **Ember Beast (boss)** — every 5th wave; radial bullet bursts and aimed spreads,
  with a health bar. Enrages below 30% health.

**Pickups** (dropped by defeated enemies)

- **Shield** — absorbs one hit.
- **Rapid fire** — double fire rate for 8 seconds.
- **Nova bomb** — clears the screen (heavy damage to the boss).
- **Heart** — +1 life (max 3).

Kills in a row build a combo multiplier (up to x5). Getting hit resets it.
Clearing a wave pays a bonus; every 3rd wave restores a life.

## Controls

- **WASD / Arrow keys** — move
- **Mouse** — aim
- **Click / Space (hold)** — shoot
- **P / Esc** — pause
- **M** — mute
- **R** — restart (on game over / victory screens)
- **Enter** — start (on the title screen)

Sound is synthesized live with WebAudio — no audio files.

## Play locally

Serve the `game/` folder with any static server, then open it in a desktop
browser:

```
cd game
python3 -m http.server 8080
```

Open `http://localhost:8080/` and play.

Staged scenes for screenshots are available with a query parameter:

- `?shot=title` — title screen
- `?shot=play` — mid-wave action with a full HUD
- `?shot=boss` — the Wave 5 boss fight
- `?shot=over` — game over screen
- `?shot=win` — victory screen

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
into the output directory and writes `dossier.json` with `buildDossier` from
`vendor/makefun-game.ts`:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`.
