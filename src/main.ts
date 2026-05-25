import './style.css';
import * as THREE from 'three';
import { InputManager } from './InputManager';
import { Player } from './Player';
import { CameraController } from './CameraController';
import { EnemyManager } from './EnemyManager';
import type { EnemyData } from './EnemyManager';
import { TargetingSystem } from './TargetingSystem';
import { WeaponSystem } from './WeaponSystem';
import { BarrierSystem } from './BarrierSystem';

const GameState = {
  START: 0,
  PLAYING: 1,
  PAUSED: 2,
  CLEARED: 3,
  GAMEOVER: 4
} as const;
type GameState = typeof GameState[keyof typeof GameState];

let currentState: GameState = GameState.START;
let startTime = 0;
let totalDamageTaken = 0;

// Set up scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x111122, 0.005);
scene.background = new THREE.Color(0x111122);

// Camera and Renderer
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('app')?.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
const d = 100;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

// Ground
const gridHelper = new THREE.GridHelper(500, 50, 0x00ff00, 0x003300);
scene.add(gridHelper);
const groundGeo = new THREE.PlaneGeometry(500, 500);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x112211, roughness: 0.8 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1;
ground.receiveShadow = true;
scene.add(ground);

// Systems
const inputManager = new InputManager();
const player = new Player(scene);
const cameraController = new CameraController(camera);
const enemyManager = new EnemyManager(scene, 10);
const targetingSystem = new TargetingSystem(camera);
const weaponSystem = new WeaponSystem();
const barrierSystem = new BarrierSystem(scene);

// UI Elements
const startScreen = document.getElementById('start-screen')!;
const pauseScreen = document.getElementById('pause-screen')!;
const clearScreen = document.getElementById('clear-screen')!;
const apValue = document.getElementById('ap-value')!;
const apBar = document.getElementById('ap-bar')!;
const targetApHud = document.getElementById('hud-top-center')!;
const targetApValue = document.getElementById('target-ap-value')!;
const targetApBar = document.getElementById('target-ap-bar')!;

const mgStatus = document.getElementById('mg-status')!;
const mgBar = document.getElementById('mg-bar')!;
const missileStatus = document.getElementById('missile-status')!;
const missileBar = document.getElementById('missile-bar')!;
const meleeStatus = document.getElementById('melee-status')!;
const meleeBar = document.getElementById('melee-bar')!;
const pauseEnemies = document.getElementById('pause-enemies')!;
const pauseAp = document.getElementById('pause-ap')!;
const clearTime = document.getElementById('clear-time')!;
const clearDamage = document.getElementById('clear-damage')!;

const gameoverScreen = document.getElementById('gameover-screen')!;
const gameoverEnemies = document.getElementById('gameover-enemies')!;

let lastTargetedEnemy: EnemyData | null = null;
let targetDisplayTimer = 0;
let rifleCooldownTimer = 0;

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Pointer Lock
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) {
    inputManager.isLocked = true;
    if (currentState === GameState.PAUSED) {
      resumeGame();
    }
  } else {
    inputManager.isLocked = false;
    if (currentState === GameState.PLAYING) {
      pauseGame();
    }
  }
});

startScreen.addEventListener('click', () => {
  if (currentState === GameState.START) {
    document.body.requestPointerLock();
    startScreen.style.display = 'none';
    currentState = GameState.PLAYING;
    startTime = performance.now();
  }
});

document.getElementById('btn-resume')?.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.getElementById('btn-restart')?.addEventListener('click', () => {
  location.reload();
});

document.getElementById('btn-finish-restart')?.addEventListener('click', () => {
  location.reload();
});

document.getElementById('btn-gameover-restart')?.addEventListener('click', () => {
  location.reload();
});

function pauseGame() {
  currentState = GameState.PAUSED;
  pauseScreen.style.display = 'flex';
  pauseEnemies.innerText = enemyManager.enemies.length.toString();
  pauseAp.innerText = player.ap.toString();
}

function resumeGame() {
  currentState = GameState.PLAYING;
  pauseScreen.style.display = 'none';
}

function clearGame() {
  currentState = GameState.CLEARED;
  document.exitPointerLock();
  clearScreen.style.display = 'flex';
  const elapsedSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
  clearTime.innerText = elapsedSeconds + "s";
  clearDamage.innerText = totalDamageTaken.toString();
}

function gameOver() {
  currentState = GameState.GAMEOVER;
  document.exitPointerLock();
  gameoverScreen.style.display = 'flex';
  gameoverEnemies.innerText = enemyManager.enemies.length.toString();
}

// Game Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();
  const time = clock.getElapsedTime();

  if (currentState !== GameState.PLAYING) {
    inputManager.resetPerFrameData();
    renderer.render(scene, camera);
    return;
  }

  // Check clear condition
  if (enemyManager.enemies.length === 0) {
    clearGame();
    return;
  }

  // 1. Update Player & Camera
  player.update(deltaTime, inputManager, cameraController.yaw);
  cameraController.update(inputManager, player.mesh.position);

  // 2. Targeting
  const target = targetingSystem.update(enemyManager.getMeshes(), player.mesh.position);

  // 3. Weapons
  // Rifle
  if (rifleCooldownTimer > 0) rifleCooldownTimer -= deltaTime;
  if (inputManager.justClickedLeft && rifleCooldownTimer <= 0) {
    const origin = player.mesh.position.clone();
    origin.y += 1.0;
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    weaponSystem.shootRifle(scene, origin, direction, target);
    rifleCooldownTimer = 0.5;
  }

  // Machine Gun
  if (inputManager.isRightMouseDown) {
    const origin = player.mesh.position.clone();
    origin.y += 1.0;
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    weaponSystem.shootMachineGun(scene, origin, direction, target);
  }

  // Missile
  if (inputManager.missileTriggered) {
    const origin = player.mesh.position.clone();
    origin.y += 2.0;
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    weaponSystem.shootMissile(scene, origin, direction, target);
  }

  // Melee (Assault Armor)
  if (inputManager.meleeTriggered) {
    const origin = player.mesh.position.clone();
    weaponSystem.triggerMelee(scene, origin, enemyManager.enemies, (enemy, dmg) => {
      enemyManager.takeDamage(enemy, dmg, scene);
      lastTargetedEnemy = enemy;
      targetDisplayTimer = 1.5;
    });
  }

  // 4. Enemy AI
  enemyManager.update(deltaTime, player.mesh.position, weaponSystem, scene);

  // 5. Barrier
  barrierSystem.update(deltaTime, inputManager, player.mesh.position, time);

  // 6. Update Projectiles & Collisions
  weaponSystem.update(
    deltaTime,
    scene,
    player.mesh.position,
    barrierSystem.isActive,
    enemyManager.enemies,
    // onPlayerHit
    (hitPos) => {
      if (barrierSystem.isActive) {
        barrierSystem.registerHit(hitPos);
      } else {
        const dmg = 50;
        player.takeDamage(dmg);
        totalDamageTaken += dmg;
        apValue.innerText = player.ap.toString();
        apBar.style.width = `${(player.ap / player.maxAp) * 100}%`;
        
        if (player.ap <= 0 && currentState === GameState.PLAYING) {
          gameOver();
        }
      }
    },
    // onEnemyHit
    (enemy, dmg) => {
      enemyManager.takeDamage(enemy, dmg, scene);
      lastTargetedEnemy = enemy;
      targetDisplayTimer = 1.5; // Show enemy AP for 1.5s
    },
    inputManager.isRightMouseDown
  );

  // 7. Update UI HUD
  if (targetDisplayTimer > 0 && lastTargetedEnemy && lastTargetedEnemy.ap > 0) {
    targetDisplayTimer -= deltaTime;
    targetApHud.style.display = 'block';
    targetApValue.innerText = lastTargetedEnemy.ap.toString();
    targetApBar.style.width = `${(lastTargetedEnemy.ap / lastTargetedEnemy.maxAp) * 100}%`;
  } else {
    targetApHud.style.display = 'none';
  }

  // Weapon HUD updates
  // Machine Gun
  if (weaponSystem.mgOverheatTimer > 0) {
    mgStatus.innerText = `COOLDOWN: ${weaponSystem.mgOverheatTimer.toFixed(1)}s`;
    mgStatus.style.color = '#ff3333';
    mgBar.style.width = '100%';
    mgBar.classList.add('overheat');
  } else {
    const heatPercent = ((weaponSystem.mgMaxHeat - weaponSystem.mgHeat) / weaponSystem.mgMaxHeat) * 100;
    mgStatus.innerText = `HEAT: ${heatPercent.toFixed(0)}%`;
    mgStatus.style.color = '#00ffff';
    mgBar.style.width = `${heatPercent}%`;
    mgBar.classList.remove('overheat');
  }

  // Missile
  if (weaponSystem.missileCooldown > 0) {
    missileStatus.innerText = `RELOADING: ${weaponSystem.missileCooldown.toFixed(1)}s`;
    missileStatus.style.color = '#ffaa00';
    missileBar.style.width = `${(weaponSystem.missileCooldown / 5.0) * 100}%`;
  } else {
    missileStatus.innerText = 'READY';
    missileStatus.style.color = '#00ffff';
    missileBar.style.width = '0%';
  }

  // Melee
  if (weaponSystem.meleeCooldown > 0) {
    meleeStatus.innerText = `RECHARGING: ${weaponSystem.meleeCooldown.toFixed(0)}s`;
    meleeStatus.style.color = '#ffaa00';
    meleeBar.style.width = `${(weaponSystem.meleeCooldown / 180.0) * 100}%`;
  } else {
    meleeStatus.innerText = 'READY';
    meleeStatus.style.color = '#00ffff';
    meleeBar.style.width = '0%';
  }

  inputManager.resetPerFrameData();
  renderer.render(scene, camera);
}

// Start loop
animate();
