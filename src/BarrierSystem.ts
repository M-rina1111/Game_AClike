import * as THREE from 'three';
import { InputManager } from './InputManager';

export class BarrierSystem {
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  public isActive = false;
  private isUsed = false;
  private duration = 3.0; // Active for 3 seconds
  private currentTimer = 0;
  private uiElement: HTMLElement | null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geometry = new THREE.SphereGeometry(4, 32, 16);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.3,
      transmission: 0.9,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });
    this.mesh = new THREE.Mesh(geometry, material);
    
    this.uiElement = document.getElementById('barrier-status');
  }

  public update(deltaTime: number, input: InputManager, playerPos: THREE.Vector3) {
    if (!this.isUsed && input.barrierPressed) {
      this.activate();
    }

    if (this.isActive) {
      this.currentTimer -= deltaTime;
      
      // Follow player
      this.mesh.position.copy(playerPos);

      // Pulse effect
      const scale = 1.0 + Math.sin(this.currentTimer * 10) * 0.02;
      this.mesh.scale.set(scale, scale, scale);

      if (this.currentTimer <= 0) {
        this.deactivate();
      }
    }
  }

  private activate() {
    this.isActive = true;
    this.isUsed = true;
    this.currentTimer = this.duration;
    this.scene.add(this.mesh);

    if (this.uiElement) {
      this.uiElement.innerText = 'OFFLINE';
      this.uiElement.classList.add('used');
    }
  }

  private deactivate() {
    this.isActive = false;
    this.scene.remove(this.mesh);
  }
}
