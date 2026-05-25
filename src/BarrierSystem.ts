import * as THREE from 'three';
import { InputManager } from './InputManager';

export class BarrierSystem {
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private scene: THREE.Scene;
  public isActive = false;
  private isUsed = false;
  private duration = 3.0;
  private currentTimer = 0;
  private uiElement: HTMLElement | null;

  // Ripples
  private MAX_RIPPLES = 5;
  private hitPositionsArray: THREE.Vector3[] = [];
  private hitTimesArray: number[] = [];
  private currentRippleIndex = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    
    for (let i = 0; i < this.MAX_RIPPLES; i++) {
      this.hitPositionsArray.push(new THREE.Vector3(0, 0, 0));
      this.hitTimesArray.push(999.0);
    }

    const geometry = new THREE.SphereGeometry(5, 64, 64); // Slightly larger than player

    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vPosition = worldPosition.xyz;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `;

    const fragmentShader = `
      uniform vec3 glowColor;
      uniform float rimPower;
      uniform float rimIntensity;
      uniform float hexScale;
      
      uniform float uTime;
      uniform float noiseScale;
      uniform float noiseRoughness;
      uniform float noiseLacunarity;

      #define MAX_RIPPLES 5
      uniform vec3 hitPositions[MAX_RIPPLES]; 
      uniform float hitTimes[MAX_RIPPLES];

      uniform float hitDistortion;
      uniform float hitMaxRadius;
      uniform float hitRingWidth;

      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;

      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      float snoise(vec3 v){ 
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
        i = mod(i, 289.0 ); 
        vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;  p1 *= norm.y;  p2 *= norm.z;  p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }

      float fbm(vec3 p) {
        float value = 0.0;
        float amp = 1.0;
        float freq = noiseScale;
        for(int i = 0; i < 2; i++) {
            value += amp * snoise(p * freq);
            amp *= noiseRoughness;
            freq *= noiseLacunarity;
        }
        return value;
      }

      float hex(vec2 uv) {
        uv.x *= 2.0; 
        vec2 r = vec2(1.0, 1.732);
        vec2 h = r * 0.5;
        vec2 a = mod(uv, r) - h;
        vec2 b = mod(uv - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        float d = max(abs(gv.x), dot(abs(gv), normalize(r)));
        return smoothstep(0.4, 0.5, d);
      }

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vPosition);

        vec3 noisePos = vPosition + vec3(0.0, uTime * 0.5, uTime * 0.2);
        float n = fbm(noisePos);
        vec3 distortedNormal = normalize(normal + n * 0.5);

        float rim = 1.0 - max(dot(viewDir, distortedNormal), 0.0);
        float rimGlow = pow(rim, rimPower) * rimIntensity;
        float hexLine = hex(vUv * hexScale + n * 0.1);
        float noiseWave = smoothstep(-0.5, 0.5, n);

        float totalHitEffect = 0.0;
        for(int i = 0; i < MAX_RIPPLES; i++) {
            float t = hitTimes[i];
            if (t < 1.0) {
                float distToHit = distance(vPosition, hitPositions[i]) + (n * hitDistortion);
                float rippleRadius = t * hitMaxRadius;
                float ring = smoothstep(hitRingWidth, 0.0, abs(distToHit - rippleRadius));
                float fadeOut = max(0.0, 1.0 - t);
                totalHitEffect += ring * fadeOut * 5.0;
            }
        }

        float finalIntensity = (rimGlow + (hexLine * (rim + 0.1))) * (0.4 + noiseWave * 0.6) + totalHitEffect;

        gl_FragColor = vec4(glowColor * finalIntensity, finalIntensity);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        glowColor: { value: new THREE.Color(0x00aaff) },
        rimPower: { value: 1.5 },
        rimIntensity: { value: 2.5 },
        hexScale: { value: 20.0 },
        uTime: { value: 0.0 },
        noiseScale: { value: 5.0 },
        noiseRoughness: { value: 0.5 },
        noiseLacunarity: { value: 2.0 },
        hitPositions: { value: this.hitPositionsArray },
        hitTimes: { value: this.hitTimesArray },
        hitDistortion: { value: 0.2 },
        hitMaxRadius: { value: 3.0 },
        hitRingWidth: { value: 0.1 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.uiElement = document.getElementById('barrier-status');
  }

  public registerHit(point: THREE.Vector3) {
    if (!this.isActive) return;
    this.hitPositionsArray[this.currentRippleIndex].copy(point);
    this.hitTimesArray[this.currentRippleIndex] = 0.0;
    this.currentRippleIndex = (this.currentRippleIndex + 1) % this.MAX_RIPPLES;
  }

  public update(deltaTime: number, input: InputManager, playerPos: THREE.Vector3, time: number) {
    // Check keyup trigger instead of keydown
    if (!this.isUsed && input.barrierTriggered) {
      this.activate();
    }

    if (this.isActive) {
      this.currentTimer -= deltaTime;
      this.mesh.position.copy(playerPos);
      
      this.material.uniforms.uTime.value = time;

      for (let i = 0; i < this.MAX_RIPPLES; i++) {
        if (this.hitTimesArray[i] < 1.0) {
          this.hitTimesArray[i] += deltaTime * 2.0; // speed
        }
      }

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
