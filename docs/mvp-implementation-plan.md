# Browser Tower Defense MVP Implementation Plan

## Goal
Build a **single-player browser Tower Defense MVP** with **Phaser 3 + TypeScript + Vite**. The outcome should be a small but complete game loop: load into a playable map, place towers on valid build tiles, spawn enemy waves along a fixed path, deal damage/projectiles, lose lives when enemies leak, earn currency for kills/waves, and restart after win/lose.

## Tech Stack
- **Runtime/build:** Vite
- **Language:** TypeScript
- **Game engine:** Phaser 3
- **Testing:** Vitest + jsdom for pure logic/UI helpers
- **Lint/format:** ESLint + Prettier
- **Package manager:** npm

## Suggested Repository Structure

```text
/
├─ README.md
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ tsconfig.node.json
├─ vite.config.ts
├─ vitest.config.ts
├─ eslint.config.js
├─ .prettierrc
├─ .gitignore
├─ public/
│  └─ favicon.svg
├─ src/
│  ├─ main.ts
│  ├─ app/
│  │  ├─ game.ts
│  │  ├─ config.ts
│  │  └─ constants.ts
│  ├─ scenes/
│  │  ├─ BootScene.ts
│  │  ├─ PreloadScene.ts
│  │  ├─ MenuScene.ts
│  │  ├─ GameScene.ts
│  │  └─ UIScene.ts
│  ├─ systems/
│  │  ├─ economy/
│  │  │  └─ EconomySystem.ts
│  │  ├─ waves/
│  │  │  ├─ WaveSystem.ts
│  │  │  └─ waveDefinitions.ts
│  │  ├─ path/
│  │  │  └─ PathSystem.ts
│  │  ├─ placement/
│  │  │  └─ PlacementSystem.ts
│  │  ├─ combat/
│  │  │  ├─ TargetingSystem.ts
│  │  │  ├─ ProjectileSystem.ts
│  │  │  └─ DamageSystem.ts
│  │  └─ game-state/
│  │     └─ GameStateStore.ts
│  ├─ entities/
│  │  ├─ enemies/
│  │  │  ├─ Enemy.ts
│  │  │  └─ enemyFactory.ts
│  │  ├─ towers/
│  │  │  ├─ Tower.ts
│  │  │  ├─ towerFactory.ts
│  │  │  └─ towerDefinitions.ts
│  │  └─ projectiles/
│  │     └─ Projectile.ts
│  ├─ ui/
│  │  ├─ hud.ts
│  │  ├─ towerPanel.ts
│  │  └─ gameOverOverlay.ts
│  ├─ data/
│  │  ├─ mapDefinition.ts
│  │  ├─ enemyDefinitions.ts
│  │  └─ balance.ts
│  ├─ types/
│  │  ├─ game.ts
│  │  ├─ enemy.ts
│  │  ├─ tower.ts
│  │  └─ wave.ts
│  ├─ utils/
│  │  ├─ grid.ts
│  │  ├─ math.ts
│  │  └─ events.ts
│  └─ assets/
│     ├─ generated/
│     │  └─ placeholderTextures.ts
│     └─ audio/
│        └─ .gitkeep
├─ tests/
│  ├─ data/
│  │  ├─ balance.test.ts
│  │  └─ waveDefinitions.test.ts
│  ├─ systems/
│  │  ├─ EconomySystem.test.ts
│  │  ├─ PlacementSystem.test.ts
│  │  ├─ TargetingSystem.test.ts
│  │  └─ DamageSystem.test.ts
│  ├─ utils/
│  │  └─ grid.test.ts
│  └─ smoke/
│     └─ app.boot.test.ts
└─ docs/
   └─ mvp-implementation-plan.md
```

## MVP Scope Lock
Ship only the following:
- 1 playable map
- 1 enemy path
- 3 tower types max:
  - Basic single-target
  - Fast/cheap low-damage
  - Heavy/slow high-damage
- 3 enemy types max:
  - Basic
  - Fast/low-health
  - Tank/high-health
- 5 to 8 handcrafted waves
- No tower upgrades
- No status effects
- No multiple maps
- No save system
- No meta progression
- No online features
- No level editor
- No authored art pipeline beyond simple placeholder shapes/textures

This scope lock matters: finish the full gameplay loop before adding content depth.

## Phased Milestones

### Milestone 0 — Project Bootstrap
Create the Vite + TypeScript + Phaser base, test tooling, linting, and folder structure.

**Exit criteria**
- `npm run dev` launches app shell
- `npm run build` succeeds
- `npm run test` succeeds
- Placeholder Phaser scene renders in browser

### Milestone 1 — Core Game Shell
Add scene flow, central config/constants, game canvas boot, and basic HUD placeholders.

**Exit criteria**
- Boot → preload → menu → game scene flow works
- HUD shows lives, gold, wave, selected tower
- Restart path exists from game over state

### Milestone 2 — Map, Path, and Placement
Implement grid/map model, path tiles, buildable tiles, pointer hover, placement validation, and tower purchase flow.

**Exit criteria**
- Player can select a tower type and place it only on legal tiles
- Placement blocks on occupied/path/out-of-bounds/insufficient-gold tiles
- Gold is deducted only on successful placement

### Milestone 3 — Enemies, Waves, and Movement
Implement wave definitions, timed spawning, enemy movement along fixed path, life loss on leak, and win/lose checks.

**Exit criteria**
- Enemies traverse path reliably
- Waves trigger in order
- Life decreases on leak
- Game ends on all waves cleared or lives reach zero

### Milestone 4 — Combat Loop
Implement tower targeting, fire cadence, projectile travel or hitscan decision, enemy damage, death rewards, and cleanup.

**Exit criteria**
- Towers acquire valid targets in range
- Enemies take damage and die
- Currency reward granted on kill
- No obvious orphaned projectiles/enemies/towers after cleanup

### Milestone 5 — UX Polish for MVP Release
Add readable HUD, wave start countdown/indicator, selected tower affordances, restart flow, and balancing pass.

**Exit criteria**
- Game is understandable without code inspection
- HUD and overlays communicate state clearly
- Balance supports an achievable but losable MVP run

## Detailed Task Breakdown

## Phase 0 — Bootstrap and Guardrails

### Task 0.1 — Initialize project
**Files to create/modify**
- `/package.json`
- `/package-lock.json`
- `/tsconfig.json`
- `/tsconfig.node.json`
- `/vite.config.ts`
- `/src/main.ts`
- `/index.html`

**Commands**
- `npm create vite@latest . -- --template vanilla-ts`
- `npm install phaser`

**Notes**
- Keep template minimal; avoid React unless requirements change.
- Immediately verify the generated app builds before adding gameplay code.

### Task 0.2 — Add quality tooling
**Files to create/modify**
- `/eslint.config.js`
- `/.prettierrc`
- `/.gitignore`
- `/package.json`

**Commands**
- `npm install -D eslint @eslint/js typescript-eslint prettier eslint-config-prettier`

**Definition of done**
- `npm run lint` exists and passes
- `npm run format:check` exists and passes

### Task 0.3 — Add testing harness first
**Files to create/modify**
- `/vitest.config.ts`
- `/package.json`
- `/tests/smoke/app.boot.test.ts`

**Commands**
- `npm install -D vitest jsdom`

**TDD note**
- Before building systems, create one smoke test that verifies app/game config bootstrap exports are valid.

### Task 0.4 — Establish app skeleton
**Files to create/modify**
- `/src/app/game.ts`
- `/src/app/config.ts`
- `/src/app/constants.ts`
- `/src/scenes/BootScene.ts`
- `/src/scenes/PreloadScene.ts`
- `/src/scenes/MenuScene.ts`
- `/src/scenes/GameScene.ts`
- `/src/scenes/UIScene.ts`

**Definition of done**
- Phaser game instance boots from `src/main.ts`
- Scene order is deterministic
- Constants are centralized; avoid magic numbers in scenes

**Recommended commit**
- `chore: scaffold vite phaser typescript project shell`

## Phase 1 — Data Contracts and Pure Logic First

### Task 1.1 — Define shared types before implementation
**Files to create/modify**
- `/src/types/game.ts`
- `/src/types/enemy.ts`
- `/src/types/tower.ts`
- `/src/types/wave.ts`

**Notes**
- Keep interfaces small and concrete.
- Prefer plain data types for definitions and state snapshots.

### Task 1.2 — Create initial balance and content definitions
**Files to create/modify**
- `/src/data/balance.ts`
- `/src/data/enemyDefinitions.ts`
- `/src/entities/towers/towerDefinitions.ts`
- `/src/systems/waves/waveDefinitions.ts`

**Tests first**
Create tests before data implementation:
- `/tests/data/balance.test.ts`
- `/tests/data/waveDefinitions.test.ts`

**What to test**
- Starting gold/lives are positive
- All waves reference valid enemy ids
- Tower costs/damage/range/fire rate are sane non-zero values
- Final wave count matches MVP scope

**Recommended commit**
- `test: add balance and wave definition coverage`
- `feat: add typed balance and content definitions`

## Phase 2 — Map, Grid, and Placement

### Task 2.1 — Implement grid helpers as pure functions
**Files to create/modify**
- `/src/utils/grid.ts`
- `/tests/utils/grid.test.ts`

**Test first**
Cover:
- world-to-grid conversion
- grid-to-world conversion
- bounds checks
- tile occupancy helpers
- path/build tile lookup

### Task 2.2 — Define the MVP map
**Files to create/modify**
- `/src/data/mapDefinition.ts`
- `/src/types/game.ts`

**Notes**
- Use a simple authored matrix or coordinate list.
- Keep exactly one path and one buildable playfield for MVP.

### Task 2.3 — Implement placement system
**Files to create/modify**
- `/src/systems/placement/PlacementSystem.ts`
- `/src/systems/game-state/GameStateStore.ts`
- `/tests/systems/PlacementSystem.test.ts`

**Test first**
Cover:
- reject path tiles
- reject occupied tiles
- reject insufficient gold
- allow valid placements
- deduct gold only on success

### Task 2.4 — Add placement UX in scene/UI
**Files to create/modify**
- `/src/scenes/GameScene.ts`
- `/src/scenes/UIScene.ts`
- `/src/ui/towerPanel.ts`
- `/src/ui/hud.ts`

**Definition of done**
- User can select among the 3 tower types
- Hover preview indicates valid/invalid placement
- UI clearly shows tower cost and current gold

**Recommended commit**
- `test: cover grid and tower placement rules`
- `feat: add map definition and placement flow`

## Phase 3 — Enemies and Waves

### Task 3.1 — Implement path system for fixed-route movement
**Files to create/modify**
- `/src/systems/path/PathSystem.ts`
- `/src/utils/math.ts`
- `/src/entities/enemies/Enemy.ts`

**Notes**
- Keep movement deterministic along predefined waypoints.
- Do not add pathfinding for MVP.

### Task 3.2 — Implement enemy factory and definitions binding
**Files to create/modify**
- `/src/entities/enemies/enemyFactory.ts`
- `/src/data/enemyDefinitions.ts`
- `/src/entities/enemies/Enemy.ts`

### Task 3.3 — Implement wave scheduler/spawner
**Files to create/modify**
- `/src/systems/waves/WaveSystem.ts`
- `/src/systems/waves/waveDefinitions.ts`
- `/src/types/wave.ts`

**Tests first**
- `/tests/data/waveDefinitions.test.ts`
- add `/tests/systems/EconomySystem.test.ts` later for rewards if coupled

**What to test**
- wave entries spawn in correct order
- inter-spawn delay is respected in scheduler logic
- next wave does not start twice

### Task 3.4 — Wire life loss and state transitions
**Files to create/modify**
- `/src/systems/game-state/GameStateStore.ts`
- `/src/scenes/GameScene.ts`
- `/src/ui/gameOverOverlay.ts`
- `/src/ui/hud.ts`

**Definition of done**
- Enemy leak reduces lives exactly once
- Lose state halts active play cleanly
- Win state triggers when final wave is fully resolved

**Recommended commit**
- `feat: add enemy path movement and wave spawning`
- `feat: add win lose state transitions`

## Phase 4 — Combat Systems

### Task 4.1 — Implement economy system before scene wiring
**Files to create/modify**
- `/src/systems/economy/EconomySystem.ts`
- `/tests/systems/EconomySystem.test.ts`

**Test first**
Cover:
- spend succeeds only when affordable
- rewards add correctly
- lives never silently go below zero unless explicitly intended

### Task 4.2 — Implement tower domain model and factory
**Files to create/modify**
- `/src/entities/towers/Tower.ts`
- `/src/entities/towers/towerFactory.ts`
- `/src/entities/towers/towerDefinitions.ts`

### Task 4.3 — Implement targeting logic as pure/selectable behavior
**Files to create/modify**
- `/src/systems/combat/TargetingSystem.ts`
- `/tests/systems/TargetingSystem.test.ts`

**Test first**
Cover:
- choose nearest-to-exit or first-in-range rule consistently
- ignore dead/out-of-range enemies
- no target returned when none in range

### Task 4.4 — Implement projectile and damage systems
**Files to create/modify**
- `/src/entities/projectiles/Projectile.ts`
- `/src/systems/combat/ProjectileSystem.ts`
- `/src/systems/combat/DamageSystem.ts`
- `/tests/systems/DamageSystem.test.ts`

**Test first**
Cover:
- damage reduces HP correctly
- death triggers exactly once
- kill reward granted once
- projectile hit removes projectile

### Task 4.5 — Wire combat into live scene loop
**Files to create/modify**
- `/src/scenes/GameScene.ts`
- `/src/scenes/UIScene.ts`
- `/src/ui/hud.ts`

**Definition of done**
- Towers visibly attack
- Enemies die and reward gold
- No duplicated hits/rewards from the same death

**Recommended commit**
- `test: add economy targeting and damage coverage`
- `feat: implement combat loop and kill rewards`

## Phase 5 — MVP UX and Balance Pass

### Task 5.1 — Improve readability with placeholders only
**Files to create/modify**
- `/src/assets/generated/placeholderTextures.ts`
- `/src/scenes/PreloadScene.ts`
- `/src/scenes/GameScene.ts`

**Notes**
- Generate primitive textures/shapes in code to avoid asset overhead.
- Use consistent color language for path/build/enemy/tower/projectile.

### Task 5.2 — Finalize HUD and overlays
**Files to create/modify**
- `/src/ui/hud.ts`
- `/src/ui/towerPanel.ts`
- `/src/ui/gameOverOverlay.ts`
- `/src/scenes/UIScene.ts`

**Definition of done**
- HUD always shows gold/lives/wave
- Restart CTA works
- Win/lose messaging is clear

### Task 5.3 — Balance and smoke verification
**Files to create/modify**
- `/src/data/balance.ts`
- `/src/data/enemyDefinitions.ts`
- `/src/entities/towers/towerDefinitions.ts`
- `/src/systems/waves/waveDefinitions.ts`
- `/tests/smoke/app.boot.test.ts`

**Manual verification checklist**
- Early wave can be beaten with correct placement
- Bad placements can still lose the game
- Heavy tower has a real niche vs tank enemies
- Fast tower is useful but not strictly dominant

**Recommended commit**
- `feat: polish hud overlays and placeholder visuals`
- `chore: tune mvp balance for full playable loop`

## Recommended Development Workflow
For each code-producing task:
1. Create/update test file first for pure logic where practical.
2. Implement the smallest code change to pass.
3. Run targeted tests.
4. Run full test suite.
5. Run lint/build before commit.
6. Commit immediately after a coherent slice.

### Baseline commands
- `npm install`
- `npm run dev`
- `npm run test`
- `npm run test -- --run`
- `npm run build`
- `npm run lint`
- `npm run format:check`

## Testing Approach
Prioritize **unit tests for deterministic logic** and **manual smoke checks for Phaser scene behavior**.

### Unit-test these first
- Grid math and coordinate conversion
- Placement validation
- Economy spending/rewards
- Wave definition integrity
- Target selection rules
- Damage/death reward behavior

### Avoid over-testing
- Do not deeply snapshot Phaser display objects
- Do not build a full browser automation suite for MVP unless regressions force it

### Manual smoke scenarios
1. Start game from menu.
2. Place each tower type on a valid tile.
3. Attempt invalid placements: occupied, path, insufficient gold.
4. Run through at least one full successful playthrough.
5. Trigger a failure state by not placing enough towers.
6. Restart and confirm state fully resets.

## Risks and Mitigations
- **Phaser scene coupling grows too fast** → keep pure logic in systems/utils and scene code thin.
- **Balance churn slows progress** → lock content count early; adjust numeric values only after loop is complete.
- **Too much polish too soon** → placeholders only until the full game loop works.
- **State bugs from implicit mutation** → centralize authoritative runtime state in `GameStateStore` and definition data in `/src/data`.
- **Feature creep** → explicitly reject upgrades, multiple maps, status effects, and meta systems for MVP.

## Non-Goals
- Responsive mobile-first UX
- Accessibility polish beyond readable text contrast
- Persisted settings/save data
- Endless mode
- Advanced enemy AI/pathfinding
- Tower sell/upgrade trees
- Audio pipeline beyond optional placeholder hooks
- Production analytics/telemetry

## Suggested First 48-Hour Build Order
1. Scaffold Vite/TypeScript/Phaser/tooling.
2. Boot Phaser with MenuScene and empty GameScene.
3. Add types, balance data, wave data tests.
4. Add map definition + grid utils tests.
5. Add placement rules + UI selection.
6. Add enemy movement + leak/lives.
7. Add tower targeting + damage + kill rewards.
8. Add HUD, restart flow, and final balance pass.

## Deliverable Definition
The MVP is done when a fresh clone can:
- install dependencies,
- run the game locally,
- play through one complete tower defense session,
- pass automated unit tests for core logic,
- and build successfully for production.
