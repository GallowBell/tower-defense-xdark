import type { EnemyArchetype, EnemyId, EnemyState } from '../../types/enemy';
import { ENEMY_DEFINITIONS } from '../../data/enemyDefinitions';
import type { Vec2 } from '../../types/game';

/**
 * Pure-TS EnemyFactory — no Phaser dependency.
 * Creates fresh EnemyState objects from archetype definitions.
 */
export class EnemyFactory {
  private nextId = 0;

  /**
   * Create a fresh EnemyState at the given world position.
   * - uid: branded as EnemyId, format "enemy_0", "enemy_1", ...
   * - hp and maxHp both set to definition.hp
   * - speed, reward, radius, color all from ENEMY_DEFINITIONS[archetype]
   * - waypointIndex: 0 (start at first waypoint — PathSystem handles movement)
   * - dead: false, leaked: false
   */
  create(archetype: EnemyArchetype, spawnPos: Vec2): EnemyState {
    const def = ENEMY_DEFINITIONS[archetype];
    const uid = `enemy_${this.nextId}` as EnemyId;
    this.nextId += 1;

    return {
      uid,
      archetype,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      reward: def.reward,
      waypointIndex: 0,
      x: spawnPos.x,
      y: spawnPos.y,
      radius: def.radius,
      color: def.color,
      dead: false,
      leaked: false,
    };
  }
}
