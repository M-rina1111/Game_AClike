export class InputManager {
  public keys: { [key: string]: boolean } = {};
  public mouseMovement = { x: 0, y: 0 };
  public isLeftMouseDown = false;
  public justClicked = false;
  public isLocked = false;
  
  // Specific one-time actions
  public jumpPressed = false;
  public barrierPressed = false;

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.jumpPressed = true;
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.barrierPressed = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isLeftMouseDown = true;
        this.justClicked = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isLeftMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isLocked) {
        this.mouseMovement.x += e.movementX;
        this.mouseMovement.y += e.movementY;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement !== null;
    });
  }

  public resetPerFrameData() {
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
    this.jumpPressed = false;
    this.barrierPressed = false;
    this.justClicked = false;
  }
}
