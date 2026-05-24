import * as THREE from 'three';

export class TargetingSystem {
  private camera: THREE.PerspectiveCamera;
  private frustum: THREE.Frustum = new THREE.Frustum();
  private projScreenMatrix: THREE.Matrix4 = new THREE.Matrix4();
  
  public currentTarget: THREE.Mesh | null = null;
  private uiSite: HTMLElement | null;

  // Parameters to adjust targeting weight (as requested by user)
  // These can be tweaked later to fine-tune lock-on behavior
  public config = {
    screenCenterWeight: 1.0,  // How much to care about being close to screen center
    physicalDistanceWeight: 0.05, // How much to care about being close in 3D space
    maxLockDistance: 150.0 // Maximum distance to lock on
  };

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.uiSite = document.getElementById('lockon-site');
  }

  public update(enemies: THREE.Mesh[], playerPos: THREE.Vector3) {
    // Update frustum based on camera
    this.camera.updateMatrixWorld();
    this.projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    let bestScore = Infinity;
    let bestTarget: THREE.Mesh | null = null;

    for (const enemy of enemies) {
      // Check if inside frustum (camera view)
      if (!this.frustum.intersectsObject(enemy)) continue;

      // Distance check
      const dist3D = playerPos.distanceTo(enemy.position);
      if (dist3D > this.config.maxLockDistance) continue;

      // Project to 2D screen space to find distance to center
      const screenPos = enemy.position.clone().project(this.camera);
      // screenPos.x and .y are in NDC (-1 to 1)
      const dist2D = Math.sqrt(screenPos.x * screenPos.x + screenPos.y * screenPos.y);

      // Score calculation: Lower is better
      // Combining 2D distance to center and 3D physical distance
      const score = (dist2D * this.config.screenCenterWeight) + (dist3D * this.config.physicalDistanceWeight);

      if (score < bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }

    this.currentTarget = bestTarget;

    // Update UI Marker
    if (this.currentTarget && this.uiSite) {
      const screenPos = this.currentTarget.position.clone().project(this.camera);
      // Convert NDC to pixel coordinates
      const x = (screenPos.x *  .5 + .5) * window.innerWidth;
      const y = (screenPos.y * -.5 + .5) * window.innerHeight;

      this.uiSite.style.display = 'block';
      this.uiSite.style.left = `${x}px`;
      this.uiSite.style.top = `${y}px`;
      
      // Make it slightly bigger when close
      const dist = playerPos.distanceTo(this.currentTarget.position);
      const scale = Math.max(0.5, 1.5 - (dist / 100));
      this.uiSite.style.transform = `translate(-50%, -50%) scale(${scale})`;
      this.uiSite.classList.add('active');

    } else if (this.uiSite) {
      this.uiSite.style.display = 'none';
      this.uiSite.classList.remove('active');
    }
  }
}
