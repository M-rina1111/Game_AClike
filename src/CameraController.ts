import * as THREE from 'three';
import { InputManager } from './InputManager';

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  
  // Angles
  public yaw = 0;
  public pitch = 0;
  
  // Camera settings
  private distance = 15;
  private heightOffset = 3;
  private sensitivity = 0.002;

  // Limits
  private minPitch = -Math.PI / 4;
  private maxPitch = Math.PI / 3;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  public update(input: InputManager, playerPos: THREE.Vector3) {
    // Update angles based on mouse movement
    this.yaw -= input.mouseMovement.x * this.sensitivity;
    this.pitch -= input.mouseMovement.y * this.sensitivity;

    // Clamp pitch
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

    // Calculate offset based on spherical coordinates
    const offsetX = this.distance * Math.sin(this.yaw) * Math.cos(this.pitch);
    const offsetY = this.distance * Math.sin(this.pitch);
    const offsetZ = this.distance * Math.cos(this.yaw) * Math.cos(this.pitch);

    // Update camera position
    this.camera.position.x = playerPos.x + offsetX;
    this.camera.position.y = playerPos.y + this.heightOffset + offsetY;
    this.camera.position.z = playerPos.z + offsetZ;

    // Look at player (slightly above)
    const targetPos = playerPos.clone();
    targetPos.y += this.heightOffset;
    this.camera.lookAt(targetPos);
  }
}
