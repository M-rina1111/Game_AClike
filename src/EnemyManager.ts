import * as THREE from 'three';
import type { WeaponSystem } from './WeaponSystem';

export interface EnemyData {
  mesh: THREE.Mesh;
  fireTimer: number;
  ap: number;
  maxAp: number;
}

export class EnemyManager {
  public enemies: EnemyData[] = [];

  constructor(scene: THREE.Scene, count: number = 10) {
    const geometry = new THREE.OctahedronGeometry(2, 0);
    geometry.scale(1, 1.5, 1);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xff3333,
      roughness: 0.3,
      metalness: 0.8
    });

    for (let i = 0; i < count; i++) {
      const material = baseMaterial.clone();
      const mesh = new THREE.Mesh(geometry, material);
      
      const angle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 80;
      
      mesh.position.x = Math.cos(angle) * radius;
      mesh.position.y = 2.0; 
      mesh.position.z = Math.sin(angle) * radius;

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      scene.add(mesh);
      this.enemies.push({ 
        mesh, 
        fireTimer: Math.random() * 2.0,
        ap: 3000,
        maxAp: 3000
      });
    }
  }

  public getMeshes(): THREE.Mesh[] {
    return this.enemies.map(e => e.mesh);
  }

  public takeDamage(enemy: EnemyData, amount: number, scene: THREE.Scene) {
    enemy.ap = Math.max(0, enemy.ap - amount);
    
    // Flash white when hit (simple visual feedback)
    const mat = (enemy.mesh.material as THREE.MeshStandardMaterial);
    const originalColor = mat.color.getHex();
    mat.color.setHex(0xffffff);
    setTimeout(() => {
      if (enemy.ap > 0) {
        mat.color.setHex(originalColor);
      }
    }, 50);

    if (enemy.ap <= 0) {
      scene.remove(enemy.mesh);
      const index = this.enemies.indexOf(enemy);
      if (index > -1) {
        this.enemies.splice(index, 1);
      }
    }
  }

  public update(deltaTime: number, playerPos: THREE.Vector3, weapons: WeaponSystem, scene: THREE.Scene) {
    for (const enemy of this.enemies) {
      enemy.fireTimer -= deltaTime;

      if (enemy.fireTimer <= 0) {
        const origin = enemy.mesh.position.clone();
        origin.y += 1.0; 
        
        const targetPos = playerPos.clone();
        targetPos.y += 1.5;

        const direction = new THREE.Vector3().subVectors(targetPos, origin).normalize();

        weapons.shootRifle(scene, origin, direction, targetPos, true);
        enemy.fireTimer = 1.0;
      }
    }
  }
}
