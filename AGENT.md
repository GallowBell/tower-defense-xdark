# tower-defense-xdark

A tower-defense game in Phaser 3 + TypeScript, built with Vite. Single canvas,
no backend, deployed to GitHub Pages.

## Commands

| Command                | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run dev`          | Vite dev server                                                    |
| `npm test`             | Vitest (jsdom), the fast inner loop                                |
| `npm run lint`         | ESLint                                                             |
| `npm run format:check` | Prettier — **gated in CI**, so run `npm run format` before pushing |
| `npm run build`        | Both tsconfigs, then `vite build`                                  |
| `npm run e2e`          | Playwright smoke suite against the production bundle               |

CI runs all of the above on every PR, in two jobs: `verify` and `Browser smoke`.

## Architecture

**`RunSimulator` owns the rules; scenes only render them.** It is Phaser-free
and holds the `GameStateStore` plus the placement, path, combat, upgrade and
wave systems. `GameScene` feeds it input and draws the result. This split is
what lets balance claims be asserted in a unit test instead of argued about —
see `tests/balance/campaign.test.ts`, which plays whole 8-wave runs headlessly.

Anything that decides the outcome of a run belongs in the simulator. Scene hooks
(`onSpawn`, `onShot`, `onLeak`, `onWaveCleared`) are presentation only: sound,
sprites, particles.

**Fixed timestep.** The sim advances in `SIM_STEP` (1/60s) slices with an
accumulator, capped at `MAX_STEPS_PER_FRAME`. Never scale a variable `dt` into
it — 2x speed means _more steps_, not bigger ones. Scaling `dt` instead made
double speed harder than single, because enemies moved twice as fast while each
tower still fired at most once per call.

### Two clocks, deliberately

- **Simulated seconds** (`lastSimulatedSeconds`) drive anything depicting the
  simulation: tower recoil, muzzle flash, idle bob, enemy gait, aiming. These
  keep pace at 2x and stop dead when paused, because a paused frame reports
  zero.
- **Tweens** drive anything answering an event rather than the simulation:
  place, upgrade, sell, enemy death and leak. `GameScene.applyTimeScale()` holds
  `tweens.timeScale`, `time.timeScale` and the emitters to the same scale.

Get this wrong and the symptom is subtle: the board keeps animating while
paused, or effects run at 1x while the game runs at 2x.

### Resolution

The world is a fixed 1280x720 that Phaser's FIT mode stretches to the screen.
Stretching adds no pixels, so the canvas is built at `RENDER_SCALE` times the
world instead (`src/app/renderScale.ts`), and **every scene zooms its camera by
the same factor** in `create()`:

```ts
applyCameraScale(this, RENDER_SCALE);
```

A new scene that forgets this renders into a canvas two or three times the size
it is laid out for, and everything lands in the top-left corner. For the same
reason, never read `this.cameras.main.width` for layout — under a zoomed camera
that is the canvas width in render pixels, not the 1280 the layout means. Use
`APP_DIMENSIONS`.

Phaser gives no help here: `resolution` was removed in 3.24 and never replaced,
and `ScaleManager.zoom` is ignored entirely under FIT. Two things do not follow
the camera and need their own handling:

- **Text** rasterises glyphs at `style.resolution`, which defaults to 1. The
  `text` factory is overridden once in `src/app/crispText.ts` so every Text gets
  the right one. Note `GameObjectFactory.register` silently refuses to overwrite
  an existing factory — `remove` has to come first.
- **Textures drawn at 1:1** (tiles, barrels) are generated at
  `TEXTURE_SUPERSAMPLE` and drawn at `SUPERSAMPLED_SCALE`. Tower bases and enemy
  bodies are already generated much larger than they are drawn and need nothing.

`e2e/smoke.spec.ts` has a 2560x1440 spec guarding all of it; the rest of the
suite runs at 1280x720 where the scale is exactly 1 and none of this is
exercised.

### Rendering

Towers and enemies are `Container`-based views (`TowerView`, `EnemyView`), one
per entity, each owning its own transform. They were once strokes on a shared
`Graphics` wiped every frame, which is why nothing could rotate, tween or
animate independently. Do not go back to that for anything stateful.

Textures are **generated in code** (`systems/render/textures.ts`), drawn in
**white** and coloured at use time with `setTint`. Baking a colour into a
texture breaks the skin system. `ensureTextures(scene)` is idempotent and runs
once in `PreloadScene`; Phaser's texture manager outlives a scene restart.

The motion arithmetic lives in Phaser-free modules — `towerMotion.ts`,
`enemyMotion.ts`, `projectileStyle.ts` — precisely so it can be unit-tested.
Put new animation maths there, not in the view.

## Traps this codebase has already hit

- **Phaser reuses Scene instances across `scene.restart()`.** Field
  initialisers do _not_ re-run. Every mutable field must be reset by hand at the
  top of `create()`. A stale `overlayShown` once froze the whole board on
  "Play Again".
- **Vite resolves `vite.config.js` before `vite.config.ts`.** A stale emitted
  `.js` silently shadows the real config. Both are gitignored; keep it that way.
- **A renderer must never re-derive a rule.** The build preview calls
  `validatePlacement`, the same function the click runs, so the ghost cannot
  disagree with the placement it previews.
- **Immediate-mode `Graphics` is cleared at the start of each frame.** Drawing
  into it from an event handler that runs later in the same frame produces
  something visible for one frame, or not at all.
- **Watch for constants declared twice.** Run-shape values live in `BALANCE`;
  `DIFFICULTY` holds scaling curves only. They were once duplicated with equal
  values and no reader for one copy, so editing it changed nothing.

## Testing

Unit tests are the inner loop and cover the simulation, balance and all
Phaser-free maths. **They cannot see the canvas.** A scene that throws on
spawn, a sprite never destroyed, an animation still running while paused —
vitest sees none of it.

`e2e/smoke.spec.ts` exists for that class of bug. It is deliberately small and
runs against `vite preview`, i.e. the production bundle.

Two habits worth keeping:

- **Assert the control, not just the condition.** The pause spec first proves
  the board _does_ move while running, because "two identical frames" is
  satisfied trivially by a frozen game. An earlier version of it passed with the
  feature reverted.
- **When verifying visuals by driving a browser, guard against a vacuous run.**
  Assert something actually happened — a tower was placed, gold changed —
  before trusting any later result. A capture script once reported three green
  results from a game that had never left its opening screen.

## Layout

```
src/
  app/        config, constants (GAME_COLORS, RENDER_DEPTH), game bootstrap
  data/       BALANCE, DIFFICULTY, enemy/map definitions, skin themes
  entities/   tower definitions
  scenes/     Boot, Preload, Menu, Game, UI
  systems/
    sim/      RunSimulator — the rules
    combat/   targeting, damage (armour + splash)
    render/   views, generated textures, Phaser-free motion maths
    placement/ path/ upgrade/ waves/ skins/ audio/ effects/
  types/      shared types
  utils/      grid maths
tests/        vitest, mirroring src/
e2e/          Playwright smoke suite
```

`src/assets/`, `src/systems/economy/` and `src/ui/` are empty `.gitkeep`
scaffolding from the original plan — nothing lives there. In particular there
are no art assets to find: every texture is generated at runtime.
