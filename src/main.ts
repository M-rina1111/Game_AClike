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

// --- State ---
let playerAP = 8000;
const maxAP = 8000;
let lastTargetEnemy: EnemyData | null = null;
let targetUIHideTimeout: ReturnType<typeof setTimeout> | null = null;

// UI Elements
const apValueUI = document.getElementById('ap-value');
const apBarUI = document.getElementById('ap-bar');
const targetHUD = document.getElementById('hud-top-center');
const targetAPValueUI = document.getElementById('target-ap-value');
const targetAPBarUI = document.getElementById('target-ap-bar');

function updateAP(amount: number) {
  playerAP = Math.max(0, playerAP + amount);
  if (apValueUI) apValueUI.innerText = playerAP.toString();
  if (apBarUI) {
    const percent = (playerAP / maxAP) * 100;
    apBarUI.style.width = `${percent}%`;
    if (percent < 30) {
      apBarUI.style.backgroundColor = 'red';
      apBarUI.style.boxShadow = '0 0 10px red';
    }
  }
}

function updateTargetHUD(enemy: EnemyData) {
  lastTargetEnemy = enemy;
  if (!targetHUD || !targetAPValueUI || !targetAPBarUI) return;

  targetHUD.style.display = 'flex';
  targetAPValueUI.innerText = enemy.ap.toString();
  
  const percent = Math.max(0, (enemy.ap / enemy.maxAp) * 100);
  targetAPBarUI.style.width = `${percent}%`;

  if (enemy.ap <= 0) {
    // Hide UI after a short delay if enemy is destroyed
    if (targetUIHideTimeout) clearTimeout(targetUIHideTimeout);
    targetUIHideTimeout = setTimeout(() => {
      if (lastTargetEnemy === enemy) {
        targetHUD.style.display = 'none';
        lastTargetEnemy = null;
      }
    }, 1500);
  }
}

// Initialization
const appDiv = document.getElementById('app')!;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.005);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
appDiv.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
scene.add(dirLight);

// Environment (Floor)
const gridHelper = new THREE.GridHelper(500, 100, 0x00ffff, 0x003333);
gridHelper.position.y = 0.1;
scene.add(gridHelper);

const planeGeo = new THREE.PlaneGeometry(500, 500);
const planeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

// Systems
const input = new InputManager();
const player = new Player(scene);
const cameraController = new CameraController(camera);
const enemies = new EnemyManager(scene, 15);
const targeting = new TargetingSystem(camera);
const weapons = new WeaponSystem();
const barrier = new BarrierSystem(scene);

// Pointer Lock / Start Screen
const startScreen = document.getElementById('start-screen')!;
startScreen.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) {
    startScreen.style.display = 'none';
  } else {
    startScreen.style.display = 'flex';
  }
});

// Main Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  if (input.isLocked) {
    // Systems update
    player.update(deltaTime, input, cameraController.yaw);
    cameraController.update(input, player.getPosition());
    
    enemies.update(deltaTime, player.getPosition(), weapons, scene);
    
    const enemyMeshes = enemies.getMeshes();
    targeting.update(enemyMeshes, player.getPosition());
    
    // Shoot
    if (input.justClicked) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      
      const origin = player.getPosition().clone();
      origin.y += 1.5;

      weapons.shoot(scene, origin, dir, targeting.currentTarget, false);
    }
    
    // Weapon update
    weapons.update(
      deltaTime, 
      scene, 
      player.getPosition(), 
      barrier.isActive, 
      enemies.enemies,
      () => {
        // Player Hit
        updateAP(-50);
      },
      (hitEnemy) => {
        // Enemy Hit (Player deals 300 damage per shot for this prototype)
        enemies.takeDamage(hitEnemy, 300, scene);
        updateTargetHUD(hitEnemy);
      }
    );

    barrier.update(deltaTime, input, player.getPosition());
  }

  input.resetPerFrameData();
  renderer.render(scene, camera);
}

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
