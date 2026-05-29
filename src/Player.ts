import * as THREE from 'three';
import { InputManager } from './InputManager';

export class Player {
  public mesh: THREE.Mesh;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public ap: number = 8000;
  public maxAp: number = 8000;
  
  private qbVelocity: THREE.Vector3 = new THREE.Vector3();
  private qbCooldown: number = 0;

  private speed = 25.0;
  private jumpForce = 20.0;
  private gravity = 50.0;
  private isGrounded = true;

  constructor(scene: THREE.Scene) {
    // Player AC represented as an Octahedron
    const geometry = new THREE.OctahedronGeometry(2, 0); // Radius 2, detail 0
    // Optional: scale to make it taller like a diamond
    geometry.scale(1, 1.5, 1);
    
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xaaaaaa,
      roughness: 0.3,
      metalness: 0.8
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = 3.0; // Half of height (2 * 1.5) to rest on ground
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  public update(deltaTime: number, input: InputManager, cameraYaw: number) {
    // Determine movement direction based on camera yaw
    const moveDir = new THREE.Vector3(0, 0, 0);
    
    if (input.keys['KeyW']) moveDir.z -= 1;
    if (input.keys['KeyS']) moveDir.z += 1;
    if (input.keys['KeyA']) moveDir.x -= 1;
    if (input.keys['KeyD']) moveDir.x += 1;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      // Rotate movement vector to match camera yaw
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
    }

    // Quick Boost Logic
    if (this.qbCooldown > 0) this.qbCooldown -= deltaTime;
    
    if (input.quickBoostTriggered && this.qbCooldown <= 0) {
      this.qbCooldown = 0.6; // 0.6s cooldown
      const qbForce = 120.0;
      
      if (moveDir.lengthSq() > 0) {
        this.qbVelocity.copy(moveDir).multiplyScalar(qbForce);
      } else {
        // Dodge forward if no input
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
        this.qbVelocity.copy(forward).multiplyScalar(qbForce);
      }
    }

    // Damping (friction) for Quick Boost
    const friction = 8.0; 
    this.qbVelocity.lerp(new THREE.Vector3(0, 0, 0), deltaTime * friction);

    // Apply movement velocity (horizontal)
    this.velocity.x = moveDir.x * this.speed;
    this.velocity.z = moveDir.z * this.speed;

    // Jumping
    if (input.jumpPressed && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
    }

    // Apply Gravity
    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * deltaTime;
    }

    // Update position
    this.mesh.position.x += (this.velocity.x + this.qbVelocity.x) * deltaTime;
    this.mesh.position.y += this.velocity.y * deltaTime;
    this.mesh.position.z += (this.velocity.z + this.qbVelocity.z) * deltaTime;

    // Floor collision
    if (this.mesh.position.y < 3.0) {
      this.mesh.position.y = 3.0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Map boundary collision (500x500 map -> limit to -245 to 245)
    const mapLimit = 245;
    if (this.mesh.position.x > mapLimit) this.mesh.position.x = mapLimit;
    if (this.mesh.position.x < -mapLimit) this.mesh.position.x = -mapLimit;
    if (this.mesh.position.z > mapLimit) this.mesh.position.z = mapLimit;
    if (this.mesh.position.z < -mapLimit) this.mesh.position.z = -mapLimit;

    // Optional: Rotate mesh to face movement direction
    if (moveDir.lengthSq() > 0) {
      const targetRotation = Math.atan2(moveDir.x, moveDir.z);
      // Smooth rotation could be added here
      this.mesh.rotation.y = targetRotation;
    }
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position;
  }

  public takeDamage(amount: number) {
    this.ap = Math.max(0, this.ap - amount);
  }
}
