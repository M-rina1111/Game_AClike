import * as THREE from 'three';
import type { EnemyData } from './EnemyManager';

interface Bullet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  isEnemy: boolean;
}

export class WeaponSystem {
  private bullets: Bullet[] = [];
  private speed = 150.0;
  private enemySpeed = 100.0;
  private geometry = new THREE.ConeGeometry(0.5, 3, 8);
  private playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  private enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff3300 });

  constructor() {
    this.geometry.rotateX(Math.PI / 2);
  }

  public shoot(scene: THREE.Scene, origin: THREE.Vector3, direction: THREE.Vector3, target: THREE.Vector3 | THREE.Mesh | null, isEnemy: boolean = false) {
    const mesh = new THREE.Mesh(this.geometry, isEnemy ? this.enemyMaterial : this.playerMaterial);
    
    mesh.position.copy(origin);
    mesh.position.addScaledVector(direction, 2);

    const velocity = new THREE.Vector3();
    const spd = isEnemy ? this.enemySpeed : this.speed;

    if (target) {
      const targetPos = target instanceof THREE.Mesh ? target.position : target;
      velocity.subVectors(targetPos, mesh.position).normalize().multiplyScalar(spd);
      mesh.lookAt(targetPos);
    } else {
      velocity.copy(direction).multiplyScalar(spd);
      const targetLook = mesh.position.clone().add(direction);
      mesh.lookAt(targetLook);
    }

    scene.add(mesh);
    this.bullets.push({ mesh, velocity, life: 2.0, isEnemy });
  }

  public update(
    deltaTime: number, 
    scene: THREE.Scene, 
    playerPos: THREE.Vector3, 
    isBarrierActive: boolean, 
    enemies: EnemyData[],
    onPlayerHit: () => void,
    onEnemyHit: (enemy: EnemyData) => void
  ) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= deltaTime;
      
      if (b.life <= 0) {
        scene.remove(b.mesh);
        this.bullets.splice(i, 1);
        continue;
      }

      b.mesh.position.x += b.velocity.x * deltaTime;
      b.mesh.position.y += b.velocity.y * deltaTime;
      b.mesh.position.z += b.velocity.z * deltaTime;

      let hit = false;

      if (b.isEnemy) {
        // Player Hit Check
        const dist = b.mesh.position.distanceTo(playerPos);
        if (isBarrierActive && dist < 5.0) {
          hit = true;
        } else if (!isBarrierActive && dist < 2.5) {
          hit = true;
          onPlayerHit();
        }
      } else {
        // Enemy Hit Check (Player's bullet)
        for (const enemy of enemies) {
          if (b.mesh.position.distanceTo(enemy.mesh.position) < 3.0) {
            hit = true;
            onEnemyHit(enemy);
            break;
          }
        }
      }

      if (hit) {
        scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }
  }
}
