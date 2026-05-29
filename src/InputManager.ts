export class InputManager {
  public keys: { [key: string]: boolean } = {};
  public mouseMovement = { x: 0, y: 0 };
  public isLeftMouseDown = false;
  public isRightMouseDown = false;
  public justClickedLeft = false;
  public justClickedRight = false;
  public isLocked = false;
  
  // Specific one-time actions
  public jumpPressed = false;
  public barrierTriggered = false; // changed to triggered on keyup
  public meleeTriggered = false;
  public missileTriggered = false;
  public quickBoostTriggered = false;
  private lastMeleeTime: number = 0;

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.jumpPressed = true;
      if (e.code === 'KeyQ') this.missileTriggered = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (this.keys['ControlLeft'] || this.keys['ControlRight']) {
          this.meleeTriggered = true;
          this.lastMeleeTime = performance.now();
        } else {
          this.quickBoostTriggered = true;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      // Barrier triggers on release of Ctrl, but not right after Assault Armor
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        if (performance.now() - this.lastMeleeTime > 500) {
          this.barrierTriggered = true;
        }
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isLeftMouseDown = true;
        this.justClickedLeft = true;
      } else if (e.button === 2) {
        this.isRightMouseDown = true;
        this.justClickedRight = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isLeftMouseDown = false;
      if (e.button === 2) this.isRightMouseDown = false;
    });

    // Prevent context menu on right click
    window.addEventListener('contextmenu', e => e.preventDefault());

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
    this.barrierTriggered = false;
    this.meleeTriggered = false;
    this.missileTriggered = false;
    this.quickBoostTriggered = false;
    this.justClickedLeft = false;
    this.justClickedRight = false;
  }
}
