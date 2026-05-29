import * as THREE from 'three';
import type { EnemyData } from './EnemyManager';

interface Bullet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  isEnemy: boolean;
  damage: number;
  isMissile?: boolean;
  trailPositions?: THREE.Vector3[];
  trailLine?: THREE.Line;
  speed?: number;
  hasLostTarget?: boolean;
}

interface MissileQueueItem {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  target: THREE.Vector3 | THREE.Mesh | null;
  delay: number;
}

interface Explosion {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export class WeaponSystem {
  private bullets: Bullet[] = [];
  private explosions: Explosion[] = [];
  private missileQueue: MissileQueueItem[] = [];

  // Geometries & Materials
  private coneGeo = new THREE.ConeGeometry(0.5, 3, 8);
  private missileGeo = new THREE.ConeGeometry(1.0, 5, 8);
  private explosionGeo = new THREE.SphereGeometry(1, 32, 32);

  private playerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  private machineGunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  private enemyMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
  private missileMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });
  private trailMat = new THREE.LineBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
  
  private explosionMat = new THREE.MeshBasicMaterial({ 
    color: 0x00ffff, 
    transparent: true, 
    opacity: 0.5, 
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  // Weapon states
  public mgHeat = 3.0; // 3 seconds worth of firing
  public mgMaxHeat = 3.0;
  public mgOverheatTimer = 0.0;
  private mgFireTimer = 0.0;

  public missileCooldown = 0.0;
  public meleeCooldown = 0.0;
  
  constructor() {
    this.coneGeo.rotateX(Math.PI / 2);
    this.missileGeo.rotateX(Math.PI / 2);
  }

  // Shoot standard Rifle
  public shootRifle(scene: THREE.Scene, origin: THREE.Vector3, direction: THREE.Vector3, target: THREE.Vector3 | THREE.Mesh | null, isEnemy: boolean = false) {
    const mesh = new THREE.Mesh(this.coneGeo, isEnemy ? this.enemyMat : this.playerMat);
    mesh.position.copy(origin).addScaledVector(direction, 2);

    const velocity = new THREE.Vector3();
    const spd = isEnemy ? 100.0 : 150.0;

    if (target) {
      const targetPos = target instanceof THREE.Mesh ? target.position : target;
      velocity.subVectors(targetPos, mesh.position).normalize().multiplyScalar(spd);
      mesh.lookAt(targetPos);
    } else {
      velocity.copy(direction).multiplyScalar(spd);
      mesh.lookAt(mesh.position.clone().add(direction));
    }

    scene.add(mesh);
    // Rifle damage: 300
    this.bullets.push({ mesh, velocity, life: 2.0, isEnemy, damage: 300 });
  }

  // Shoot Machine Gun
  public shootMachineGun(scene: THREE.Scene, origin: THREE.Vector3, direction: THREE.Vector3, target: THREE.Vector3 | THREE.Mesh | null) {
    if (this.mgOverheatTimer > 0) return; // Overheated
    if (this.mgFireTimer > 0) return; // Fire rate throttle

    // Consume heat
    this.mgHeat -= 0.1;
    if (this.mgHeat <= 0) {
      this.mgHeat = 0;
      this.mgOverheatTimer = 10.0; // 10s cooldown
    }
    
    this.mgFireTimer = 0.05; // 20 shots per second

    const mesh = new THREE.Mesh(this.coneGeo, this.machineGunMat);
    
    // Base direction towards target if available
    const spreadDir = new THREE.Vector3();
    if (target) {
      const targetPos = target instanceof THREE.Mesh ? target.position : target;
      spreadDir.subVectors(targetPos, origin).normalize();
    } else {
      spreadDir.copy(direction);
    }
    spreadDir.x += (Math.random() - 0.5) * 0.05;
    spreadDir.y += (Math.random() - 0.5) * 0.05;
    spreadDir.z += (Math.random() - 0.5) * 0.05;
    spreadDir.normalize();

    mesh.position.copy(origin).addScaledVector(spreadDir, 2);
    const velocity = new THREE.Vector3().copy(spreadDir).multiplyScalar(180.0);
    mesh.lookAt(mesh.position.clone().add(spreadDir));

    scene.add(mesh);
    // MG damage: 50
    this.bullets.push({ mesh, velocity, life: 1.5, isEnemy: false, damage: 50 });
  }

  // Shoot Missile
  public shootMissile(_scene: THREE.Scene, origin: THREE.Vector3, direction: THREE.Vector3, target: THREE.Vector3 | THREE.Mesh | null) {
    if (this.missileCooldown > 0) return;
    this.missileCooldown = 5.0; // 5s cooldown

    // Queue 5 missiles with a slight delay between them
    for (let i = 0; i < 5; i++) {
      this.missileQueue.push({
        origin: origin.clone(),
        direction: direction.clone(),
        target: target,
        delay: i * 0.15 // 150ms delay between each missile
      });
    }
  }

  private spawnMissile(scene: THREE.Scene, origin: THREE.Vector3, direction: THREE.Vector3, _target: THREE.Vector3 | THREE.Mesh | null) {
    const mesh = new THREE.Mesh(this.missileGeo, this.missileMat);
    
    const initialDir = direction.clone();
    initialDir.y += 1.5; // Shoot higher initially
    // Add some random spread
    initialDir.x += (Math.random() - 0.5) * 0.8;
    initialDir.z += (Math.random() - 0.5) * 0.8;
    initialDir.normalize();

    mesh.position.copy(origin).addScaledVector(initialDir, 3);
    const speed = 20.0; // Start slow
    const velocity = new THREE.Vector3().copy(initialDir).multiplyScalar(speed);

    const trailPositions = [mesh.position.clone()];
    const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPositions);
    const trailLine = new THREE.Line(trailGeo, this.trailMat);
    scene.add(trailLine);

    scene.add(mesh);
    // Lower damage per missile since we fire 5
    this.bullets.push({ mesh, velocity, life: 5.0, isEnemy: false, damage: 80, isMissile: true, trailPositions, trailLine, speed: speed, hasLostTarget: false });
  }

  // Melee Assault Armor
  public triggerMelee(scene: THREE.Scene, origin: THREE.Vector3, enemies: EnemyData[], onEnemyHit: (enemy: EnemyData, dmg: number) => void) {
    if (this.meleeCooldown > 0) return;
    this.meleeCooldown = 180.0; // 3 min cooldown

    // Create explosion visual
    const mesh = new THREE.Mesh(this.explosionGeo, this.explosionMat.clone());
    mesh.position.copy(origin);
    scene.add(mesh);
    this.explosions.push({ mesh, life: 0.5, maxLife: 0.5 }); // lives for 0.5s

    // Deal damage in radius 30
    for (const enemy of enemies) {
      if (enemy.mesh.position.distanceTo(origin) < 30.0) {
        onEnemyHit(enemy, 1000);
      }
    }
  }

  public update(
    deltaTime: number, 
    scene: THREE.Scene, 
    playerPos: THREE.Vector3, 
    isBarrierActive: boolean, 
    enemies: EnemyData[],
    onPlayerHit: (hitPos: THREE.Vector3) => void,
    onEnemyHit: (enemy: EnemyData, dmg: number) => void,
    isRightMouseDown: boolean // To handle MG heat recovery
  ) {
    // Timers
    if (this.mgFireTimer > 0) this.mgFireTimer -= deltaTime;
    
    if (this.mgOverheatTimer > 0) {
      this.mgOverheatTimer -= deltaTime;
      if (this.mgOverheatTimer <= 0) {
        this.mgHeat = this.mgMaxHeat; // Fully recovered
      }
    } else {
      if (!isRightMouseDown) {
        // Recover heat if not shooting and not overheated
        this.mgHeat = Math.min(this.mgMaxHeat, this.mgHeat + deltaTime * 0.5);
      }
    }

    if (this.missileCooldown > 0) this.missileCooldown -= deltaTime;
    if (this.meleeCooldown > 0) this.meleeCooldown -= deltaTime;

    // Process Missile Queue
    for (let i = this.missileQueue.length - 1; i >= 0; i--) {
      const item = this.missileQueue[i];
      item.delay -= deltaTime;
      if (item.delay <= 0) {
        this.spawnMissile(scene, item.origin, item.direction, item.target);
        this.missileQueue.splice(i, 1);
      }
    }

    // Update Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.life -= deltaTime;
      if (exp.life <= 0) {
        scene.remove(exp.mesh);
        this.explosions.splice(i, 1);
      } else {
        // Expand rapidly
        const progress = 1.0 - (exp.life / exp.maxLife);
        const scale = 1.0 + progress * 30.0;
        exp.mesh.scale.set(scale, scale, scale);
        (exp.mesh.material as THREE.Material).opacity = (1.0 - progress) * 0.5;
      }
    }

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= deltaTime;
      
      if (b.life <= 0) {
        scene.remove(b.mesh);
        if (b.trailLine) scene.remove(b.trailLine);
        this.bullets.splice(i, 1);
        continue;
      }

      // Homing logic for missile
      if (b.isMissile) {
        if (!b.hasLostTarget) {
          let targetPos: THREE.Vector3 | null = null;
          let minDist = Infinity;
          for (const enemy of enemies) {
            const d = b.mesh.position.distanceTo(enemy.mesh.position);
            if (d < 200 && d < minDist) {
              minDist = d;
              targetPos = enemy.mesh.position;
            }
          }

          if (targetPos) {
            const dirToTarget = new THREE.Vector3().subVectors(targetPos, b.mesh.position).normalize();
            const currentDir = b.velocity.clone().normalize();
            
            // Vision cone (approx 60 degrees threshold)
            // Give a 0.5s grace period at launch so the initial spread doesn't break the lock
            if (b.life < 4.5 && currentDir.dot(dirToTarget) < 0.5) {
              b.hasLostTarget = true; // Lost track of target
            } else {
              // Accelerate
              b.speed = Math.min(250.0, (b.speed || 20.0) + 120.0 * deltaTime);
              const desiredVel = dirToTarget.multiplyScalar(b.speed);
              b.velocity.lerp(desiredVel, deltaTime * 2.5); // Steer towards target
            }
          } else {
            b.hasLostTarget = true;
          }
        }

        if (b.hasLostTarget) {
          // Keep accelerating forward
          b.speed = Math.min(250.0, (b.speed || 20.0) + 120.0 * deltaTime);
          b.velocity.normalize().multiplyScalar(b.speed);
        }

        b.mesh.lookAt(b.mesh.position.clone().add(b.velocity));

        // Update trail
        if (b.trailPositions && b.trailLine) {
          b.trailPositions.push(b.mesh.position.clone());
          if (b.trailPositions.length > 20) b.trailPositions.shift(); // Keep last 20 points
          b.trailLine.geometry.setFromPoints(b.trailPositions);
        }
      }

      b.mesh.position.x += b.velocity.x * deltaTime;
      b.mesh.position.y += b.velocity.y * deltaTime;
      b.mesh.position.z += b.velocity.z * deltaTime;

      let hit = false;

      if (b.isEnemy) {
        const dist = b.mesh.position.distanceTo(playerPos);
        if (isBarrierActive && dist < 5.0) {
          hit = true;
          onPlayerHit(b.mesh.position); // Notify barrier hit
        } else if (!isBarrierActive && dist < 2.5) {
          hit = true;
          onPlayerHit(b.mesh.position);
        }
      } else {
        for (const enemy of enemies) {
          const hitRadius = b.isMissile ? 4.0 : 3.0;
          if (b.mesh.position.distanceTo(enemy.mesh.position) < hitRadius) {
            hit = true;
            onEnemyHit(enemy, b.damage);
            break;
          }
        }
      }

      if (hit) {
        scene.remove(b.mesh);
        if (b.trailLine) scene.remove(b.trailLine);
        this.bullets.splice(i, 1);
      }
    }
  }
}
