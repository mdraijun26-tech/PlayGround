import * as THREE from 'three';
import {
  makeRoadTexture,
  makeSidewalkTexture,
  makeFacadeTexture,
  makeSignTexture,
  makeBannerTexture,
  makeBusTexture,
  makeShopTexture,
  makeShopWindowTexture,
  makeGlowTexture,
  makeCloudTexture,
  makeSkylineTexture,
  makeMangoLeafTexture,
} from './textures.js';

export const LANES = [-2.6, 0, 2.6];
const SPAWN_Z = -205;
const DESPAWN_Z = 28;
const CITY_SPAN = 300;
const ROAD_LENGTH = 620;

const BUS_LABELS = ['বাংলা পরিবহন', 'ঢাকা মেট্রো', 'সুন্দরবন এক্সপ্রেস', 'বিক্রমপুর'];
const SIGN_TEXTS = ['চা ঘর', 'মিষ্টি', 'রিকশা গ্যারেজ', 'বিরিয়ানি', 'সেলুন', 'বইঘর', 'ফার্মেসি', 'জামা কাপড়'];
const SIGN_COLORS = [
  ['#10202c', '#ffcf6e', '#ff5a36'],
  ['#2a1020', '#ff9fc4', '#ffcf6e'],
  ['#0f2420', '#7dffd8', '#26d3b4'],
  ['#241a0f', '#ffe9a8', '#ff8a3c'],
];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.06, ...opts });
}

function mesh(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], cast = false) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export class World {
  constructor(scene, { quality = 'high', callbacks = {} } = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.quality = quality;
    this.time = 0;
    this.night = 0;
    this.speed = 0;
    this.city = [];
    this.props = [];
    this.obstacles = [];
    this.mangoes = [];
    this.pools = {};
    this.spawnTimer = 1.2;
    this.waveIndex = 0;
    this.roadTexture = makeRoadTexture();
    this.sidewalkTexture = makeSidewalkTexture();
    this.glowTexture = makeGlowTexture();
    this.mangoLeafTexture = makeMangoLeafTexture();
    this.facades = Array.from({ length: 8 }, (_, i) => makeFacadeTexture(i));
    this.shopWindowMats = Array.from({ length: 4 }, (_, i) => {
      const tex = makeShopWindowTexture(i);
      return new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: 0xffffff,
        emissiveIntensity: 1.05,
        roughness: 0.5,
      });
    });
    this.facadeMats = this.facades.map(({ map, emissiveMap }) => new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      emissive: 0xffb264,
      emissiveIntensity: 0.65,
      roughness: 0.88,
      metalness: 0.02,
    }));
    this.neonMats = [];
    this.traffic = [];
    this._tmp = new THREE.Vector3();

    this.buildSky();
    this.buildLights();
    this.buildGround();
    this.buildCity();
    this.buildStreetFurniture();
    this.buildTeaStall();
    this.buildWires();
    this.buildParticles();
    this.buildAmbient();
    this.spawnInitial();
  }

  /* ------------------------------------------------------------------ sky */

  buildSky() {
    const geometry = new THREE.SphereGeometry(430, 32, 20);
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x241a44) },
        horizonColor: { value: new THREE.Color(0xff9d6c) },
        bottomColor: { value: new THREE.Color(0x4a2735) },
        sunColor: { value: new THREE.Color(0xffd7a0) },
        sunDir: { value: new THREE.Vector3(0.06, 0.18, -0.98).normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          float h = dir.y;
          vec3 col = mix(horizonColor, topColor, smoothstep(-0.02, 0.62, h));
          col = mix(bottomColor, col, smoothstep(-0.28, 0.02, h));
          float d = max(dot(dir, normalize(sunDir)), 0.0);
          col += sunColor * pow(d, 6.0) * 0.16;
          col += sunColor * pow(d, 90.0) * 0.55;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(geometry, this.skyMaterial);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    const sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffc98f,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }));
    sun.position.set(24, 54, -370);
    sun.scale.set(120, 120, 1);
    this.scene.add(sun);
    this.sun = sun;

    const cloudTex = makeCloudTexture();
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex,
        color: 0xffc8a0,
        transparent: true,
        opacity: rand(0.25, 0.55),
        depthWrite: false,
        fog: false,
      }));
      cloud.position.set(rand(-280, 280), rand(38, 105), rand(-400, -220));
      cloud.scale.set(rand(120, 260), rand(50, 100), 1);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }

    const skylineTex = makeSkylineTexture();
    for (const [z, y, scale, opacity] of [[-310, 26, 1.6, 0.55], [-260, 18, 1.15, 0.75]]) {
      const skyline = new THREE.Mesh(
        new THREE.PlaneGeometry(620, 90),
        new THREE.MeshBasicMaterial({ map: skylineTex, transparent: true, opacity, depthWrite: false, fog: false })
      );
      skyline.position.set(0, y, z);
      skyline.scale.set(scale, 1, 1);
      this.scene.add(skyline);
    }

    this.scene.fog = new THREE.FogExp2(0xc47a68, 0.0053);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffbd96, 0x241a2e, 1.22);
    this.scene.add(this.hemi);

    this.sunLight = new THREE.DirectionalLight(0xffb877, 2.45);
    this.sunLight.position.set(-45, 62, -35);
    this.sunLight.castShadow = true;
    const shadowSize = this.quality === 'low' ? 1024 : 2048;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.sunLight.shadow.camera.left = -26;
    this.sunLight.shadow.camera.right = 26;
    this.sunLight.shadow.camera.top = 30;
    this.sunLight.shadow.camera.bottom = -20;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 170;
    this.sunLight.shadow.bias = -0.0008;
    this.sunLight.shadow.normalBias = 0.03;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.sunLight.target.position.set(0, 0, -12);

    this.fill = new THREE.DirectionalLight(0x7b6bff, 0.85);
    this.fill.position.set(30, 18, 40);
    this.scene.add(this.fill);

    this.scene.add(new THREE.AmbientLight(0x4a2f4a, 0.45));
  }

  /* --------------------------------------------------------------- ground */

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(420, ROAD_LENGTH + 120),
      new THREE.MeshStandardMaterial({ color: 0x241a22, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.04, -ROAD_LENGTH / 2 + 80);
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.road = new THREE.Mesh(
      new THREE.PlaneGeometry(10.6, ROAD_LENGTH),
      new THREE.MeshStandardMaterial({ map: this.roadTexture, roughness: 0.94, metalness: 0.03 })
    );
    this.road.rotation.x = -Math.PI / 2;
    this.road.position.set(0, 0, -ROAD_LENGTH / 2 + 80);
    this.road.receiveShadow = true;
    this.scene.add(this.road);

    const sidewalkMat = new THREE.MeshStandardMaterial({ map: this.sidewalkTexture, roughness: 0.95 });
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(3.4, ROAD_LENGTH), sidewalkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(side * 7.05, 0.14, -ROAD_LENGTH / 2 + 80);
      walk.receiveShadow = true;
      this.scene.add(walk);

      const curbMat = std(0x8a7668, { roughness: 0.9 });
      const curb = mesh(this.scene, new THREE.BoxGeometry(0.32, 0.3, ROAD_LENGTH), curbMat, [side * 5.36, 0.15, -ROAD_LENGTH / 2 + 80]);
      curb.receiveShadow = true;

      const rail = mesh(this.scene, new THREE.BoxGeometry(0.1, 0.1, ROAD_LENGTH), std(0x3a2d33, { metalness: 0.4, roughness: 0.5 }), [side * 8.78, 1.05, -ROAD_LENGTH / 2 + 80]);
      rail.castShadow = false;
    }
  }

  /* ----------------------------------------------------------------- city */

  buildCity() {
    const perSide = 16;
    const spacing = CITY_SPAN / perSide;
    for (const side of [-1, 1]) {
      for (let i = 0; i < perSide; i++) {
        const group = new THREE.Group();
        const z = 40 - i * spacing - rand(0, 4);
        const depth = rand(8, 15);
        const width = rand(7, 12);
        const height = rand(9, 30);
        group.position.set(side * (9.6 + width / 2 + rand(0, 1.6)), 0, z);

        const variant = (Math.random() * this.facades.length) | 0;
        const facadeMat = this.facadeMats[variant];
        const wallMat = new THREE.MeshStandardMaterial({
          color: this.facades[variant].map.image ? 0x8a6a5c : 0x7a5a50,
          roughness: 0.95,
        });

        const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), [
          facadeMat, facadeMat,
          std(0x2c2229, { roughness: 0.95 }),
          std(0x1c151a, { roughness: 1 }),
          facadeMat, facadeMat,
        ]);
        body.position.y = height / 2;
        body.receiveShadow = true;
        group.add(body);

        // rooftop clutter
        if (Math.random() < 0.85) {
          const tank = mesh(group, new THREE.CylinderGeometry(rand(0.5, 0.9), rand(0.5, 0.9), rand(0.8, 1.4), 10), std(0x1d2830, { roughness: 0.8 }), [rand(-width * 0.25, width * 0.25), height + 0.6, rand(-depth * 0.2, depth * 0.2)]);
          tank.castShadow = false;
        }
        if (Math.random() < 0.55) {
          const ac = mesh(group, new THREE.BoxGeometry(rand(0.7, 1.2), rand(0.5, 0.8), rand(0.6, 1.1)), std(0xb8ab9a, { roughness: 0.9 }), [rand(-width * 0.3, width * 0.3), height + 0.3, rand(-depth * 0.3, depth * 0.3)]);
          ac.castShadow = false;
        }
        if (Math.random() < 0.35) {
          const mast = mesh(group, new THREE.CylinderGeometry(0.03, 0.03, rand(2, 5), 4), std(0x2a2228), [rand(-width * 0.3, width * 0.3), height + 2, rand(-depth * 0.3, depth * 0.3)]);
          mast.castShadow = false;
        }

        // ground floor shop
        if (Math.random() < 0.62) {
          const shopColor = pick(['#ff5a36', '#26d3b4', '#ffcf6e', '#ff4f87', '#4f7fff']);
          const signTex = makeShopTexture(pick(SIGN_TEXTS), shopColor, '#fff4de');
          const signMat = new THREE.MeshStandardMaterial({
            map: signTex,
            emissiveMap: signTex,
            emissive: 0xffffff,
            emissiveIntensity: 1.15,
            roughness: 0.5,
          });
          this.neonMats.push(signMat);
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(rand(2.4, 3.6), 0.85), signMat);
          sign.position.set(-side * (width / 2 + 0.06), 3.35, rand(-depth * 0.28, depth * 0.28));
          sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          group.add(sign);

          const signGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: new THREE.Color(shopColor),
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }));
          signGlow.position.set(-side * (width / 2 + 0.25), 3.3, sign.position.z);
          signGlow.scale.set(4.2, 2.4, 1);
          group.add(signGlow);

          // awning
          const awning = mesh(
            group,
            new THREE.BoxGeometry(0.9, 0.08, rand(2.2, 3.2)),
            std(pick([0xc23b2f, 0x1f7a63, 0xd9a13b]), { roughness: 0.85 }),
            [-side * (width / 2 + 0.55), 2.9, rand(-depth * 0.2, depth * 0.2)],
            [0, 0, side * 0.16]
          );
          awning.castShadow = false;

          // glowing storefront window
          const shopWindow = new THREE.Mesh(new THREE.PlaneGeometry(rand(2.6, 3.5), 1.35), pick(this.shopWindowMats));
          shopWindow.position.set(-side * (width / 2 + 0.04), 1.7, sign.position.z + rand(-1.2, 1.2));
          shopWindow.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          group.add(shopWindow);

          // warm interior glow
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: 0xffb466,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }));
          glow.position.set(-side * (width / 2 + 0.2), 1.8, rand(-depth * 0.3, depth * 0.3));
          glow.scale.set(4, 3, 1);
          group.add(glow);
        }

        // a big painted billboard on one of the near buildings
        if (side === -1 && i === 2) {
          const bbTex = makeSignTexture('ঢাকা ড্যাশ', { bg: '#101a2c', fg: '#ffcf6e', accent: '#26d3b4' });
          const bbMat = new THREE.MeshStandardMaterial({
            map: bbTex,
            emissiveMap: bbTex,
            emissive: 0xffffff,
            emissiveIntensity: 1.1,
            roughness: 0.45,
          });
          const bb = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 2.3), bbMat);
          bb.position.set(width / 2 + 0.12, height * 0.66, 0);
          bb.rotation.y = Math.PI / 2;
          group.add(bb);
          const bbFrame = mesh(group, new THREE.BoxGeometry(0.22, 2.7, 7.9), std(0x241a20, { metalness: 0.4, roughness: 0.6 }), [width / 2 + 0.04, height * 0.66, 0]);
          bbFrame.castShadow = false;
          const bbGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: 0x26d3b4,
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }));
          bbGlow.position.set(width / 2 + 0.4, height * 0.66, 0);
          bbGlow.scale.set(7.5, 4.5, 1);
          group.add(bbGlow);
        }

        // occasional vertical neon sign
        if (Math.random() < 0.34) {
          const [bg, fg, accent] = pick(SIGN_COLORS);
          const tex = makeSignTexture(pick(['হোটেল', 'চা', 'বাজার', 'ঢাকা']), { bg, fg, accent, vertical: true });
          const mat = new THREE.MeshStandardMaterial({
            map: tex,
            emissiveMap: tex,
            emissive: 0xffffff,
            emissiveIntensity: 1.35,
            roughness: 0.4,
          });
          this.neonMats.push(mat);
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.4), mat);
          sign.position.set(-side * (width / 2 + 0.08), rand(5.5, 9), -depth * 0.18);
          sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          group.add(sign);
          const vGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: new THREE.Color(fg),
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }));
          vGlow.position.set(-side * (width / 2 + 0.3), sign.position.y, sign.position.z);
          vGlow.scale.set(2.4, 6.2, 1);
          group.add(vGlow);
        }

        this.scene.add(group);
        this.city.push({ group, baseZ: z, side, height });
      }
    }

    // far background block silhouettes
    for (const side of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        const w = rand(12, 24);
        const h = rand(20, 52);
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 10), new THREE.MeshBasicMaterial({ color: 0x2a1c32, fog: true }));
        b.position.set(side * rand(30, 70), h / 2, rand(-300, -170));
        this.scene.add(b);
      }
    }
  }

  /* ------------------------------------------------------ street furniture */

  buildStreetFurniture() {
    // lamp posts
    for (const side of [-1, 1]) {
      for (let i = 0; i < 11; i++) {
        const group = new THREE.Group();
        const z = 24 - i * 26 - rand(0, 3);
        group.position.set(side * 8.5, 0, z);
        const poleMat = std(0x2b2229, { metalness: 0.55, roughness: 0.45 });
        mesh(group, new THREE.CylinderGeometry(0.07, 0.11, 5.6, 8), poleMat, [0, 2.8, 0], [0, 0, 0], true);
        mesh(group, new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), poleMat, [-side * 0.65, 5.5, 0], [0, 0, Math.PI / 2], true);
        const headMat = new THREE.MeshStandardMaterial({
          color: 0xffe6b0,
          emissive: 0xffb45e,
          emissiveIntensity: 2.4,
          roughness: 0.4,
        });
        mesh(group, new THREE.BoxGeometry(0.42, 0.16, 0.28), headMat, [-side * 1.32, 5.42, 0]);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: 0xffb45e,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }));
        halo.position.set(-side * 1.32, 5.3, 0);
        halo.scale.set(3.4, 3.4, 1);
        group.add(halo);
        this.scene.add(group);
        this.props.push({ group, baseZ: z, side, kind: 'lamp' });
      }
    }

    // trees
    for (const side of [-1, 1]) {
      for (let i = 0; i < 13; i++) {
        const group = new THREE.Group();
        const z = -40 - i * 21 - rand(0, 4);
        group.position.set(side * rand(9.6, 11), 0, z);
        const palm = Math.random() < 0.5;
        if (palm) {
          const h = rand(4.6, 7.2);
          mesh(group, new THREE.CylinderGeometry(0.1, 0.2, h, 7), std(0x6b4b36, { roughness: 0.95 }), [0, h / 2, 0], [0, 0, rand(-0.05, 0.05)], true);
          const frondMat = std(pick([0x2f6b4a, 0x3a7a52, 0x275c40]), { roughness: 0.85, side: THREE.DoubleSide, flatShading: true });
          for (let f = 0; f < 9; f++) {
            const pivot = new THREE.Group();
            pivot.position.set(0, h - 0.1, 0);
            pivot.rotation.y = (f / 9) * Math.PI * 2 + rand(-0.2, 0.2);
            const len = rand(2.2, 3.2);
            const frond = new THREE.Mesh(new THREE.ConeGeometry(0.24, len, 4), frondMat);
            frond.position.set(len * 0.42, rand(-0.1, 0.15), 0);
            frond.rotation.z = -Math.PI / 2 + rand(-0.18, 0.18);
            frond.scale.set(1, 1, 0.16);
            frond.castShadow = false;
            pivot.add(frond);
            group.add(pivot);
          }
          for (let c = 0; c < 4; c++) {
            mesh(group, new THREE.SphereGeometry(0.16, 6, 5), std(0x4a3a22), [rand(-0.35, 0.35), h - 0.45, rand(-0.35, 0.35)]);
          }
        } else {
          const h = rand(2.8, 4.2);
          mesh(group, new THREE.CylinderGeometry(0.2, 0.32, h, 6), std(0x5a4030, { roughness: 0.95 }), [0, h / 2, 0], [0, 0, 0], true);
          const canopyMat = std(pick([0x2d5a3f, 0x386a48, 0x274f3b]), { roughness: 0.9, flatShading: true });
          for (let c = 0; c < 7; c++) {
            const blob = mesh(group, new THREE.SphereGeometry(rand(0.75, 1.25), 6, 5), canopyMat, [rand(-1.3, 1.3), h + rand(-0.3, 1.2), rand(-1.2, 1.2)]);
            blob.castShadow = false;
          }
          // aerial roots
          for (let r = 0; r < 4; r++) {
            mesh(group, new THREE.CylinderGeometry(0.02, 0.03, rand(1, 2.2), 4), std(0x4a3527), [rand(-1.1, 1.1), h - 0.6, rand(-1, 1)]);
          }
        }
        this.scene.add(group);
        this.props.push({ group, baseZ: z, side, kind: 'tree' });
      }
    }

    // cows resting on sidewalks
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const cow = this.createCow().group;
        cow.position.set(side * rand(9.4, 10.6), 0, 10 - i * 60 - rand(0, 12));
        cow.rotation.y = rand(0, Math.PI * 2);
        cow.scale.setScalar(0.85);
        this.scene.add(cow);
        this.props.push({ group: cow, baseZ: cow.position.z, side, kind: 'cow' });
      }
    }

    // banners over the road on distant buildings
    const bannerTex = makeBannerTexture('ঢাকা ড্যাশ', 'রিকশা রাশ · ২০২৬');
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTex,
      emissiveMap: bannerTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.55,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    for (const side of [-1, 1]) {
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), bannerMat);
      banner.position.set(side * 12.5, 7.5, -34 - (side > 0 ? 14 : 0));
      banner.rotation.y = side > 0 ? -Math.PI / 2.2 : Math.PI / 2.2;
      this.scene.add(banner);
    }
  }

  buildWires() {
    this.wires = [];
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x1a1219 });
    const bulbColors = [0xffb050, 0xff5a36, 0x26d3b4, 0xffd166, 0xff4f87];
    for (let i = 0; i < 6; i++) {
      const group = new THREE.Group();
      const points = [];
      for (let s = 0; s <= 18; s++) {
        const t = s / 18;
        points.push(new THREE.Vector3(-8.7 + t * 17.4, 5.5 - Math.sin(t * Math.PI) * 0.6, 0));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 44, 0.014, 4, false), wireMat);
      group.add(wire);
      for (let s = 1; s < 18; s += 2) {
        const pos = curve.getPoint(s / 18);
        const color = bulbColors[(i + s) % bulbColors.length];
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 6, 5),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, roughness: 0.4 })
        );
        bulb.position.copy(pos).y -= 0.12;
        group.add(bulb);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTexture,
          color,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }));
        halo.position.copy(bulb.position);
        halo.scale.set(0.55, 0.55, 1);
        group.add(halo);
      }
      group.position.z = -8 - i * 42;
      this.scene.add(group);
      this.wires.push({ group, baseZ: group.position.z });
    }
  }

  buildTeaStall() {
    const group = new THREE.Group();
    group.position.set(8.4, 0, -14);
    const wood = std(0x5c3d2c, { roughness: 0.9 });
    const metal = std(0x8f8f96, { metalness: 0.65, roughness: 0.4 });
    mesh(group, new THREE.BoxGeometry(2.6, 1.05, 1.3), wood, [0, 0.55, 0], [0, 0, 0], true);
    mesh(group, new THREE.BoxGeometry(2.9, 0.12, 1.5), std(0x2f2228), [0, 1.12, 0]);
    // awning
    const awning = mesh(group, new THREE.BoxGeometry(3.1, 0.1, 2.2), std(0xc23b2f, { roughness: 0.85 }), [0, 2.55, 0.1], [0, 0, -0.12], false);
    // poles
    for (const x of [-1.45, 1.45]) {
      mesh(group, new THREE.CylinderGeometry(0.04, 0.04, 2.55, 6), metal, [x, 1.27, -0.85]);
    }
    // kettle
    mesh(group, new THREE.CylinderGeometry(0.16, 0.2, 0.3, 10), metal, [-0.55, 1.3, 0.1], [0, 0, 0], true);
    mesh(group, new THREE.CylinderGeometry(0.02, 0.02, 0.28, 5), metal, [-0.32, 1.34, 0.1], [0, 0, -0.9]);
    // cups
    for (let i = 0; i < 4; i++) {
      mesh(group, new THREE.CylinderGeometry(0.055, 0.04, 0.09, 8), std(0xf4e6c8), [0.2 + i * 0.17, 1.23, 0.15]);
    }
    // sign
    const signTex = makeShopTexture('চা ঘর', '#ffcf6e', '#3a1a12');
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.5 });
    this.neonMats.push(signMat);
    mesh(group, new THREE.PlaneGeometry(2.1, 0.52), signMat, [0, 2.24, -0.86]);
    // string lights
    for (let i = 0; i < 5; i++) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb050, emissiveIntensity: 2.2 }));
      bulb.position.set(-1.2 + i * 0.6, 2.42 - Math.sin((i / 4) * Math.PI) * 0.16, 0.9);
      group.add(bulb);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color: 0xffb050, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.copy(bulb.position);
      halo.scale.set(0.6, 0.6, 1);
      group.add(halo);
    }
    const light = new THREE.PointLight(0xffa85e, 3.2, 14, 2);
    light.position.set(0, 2.1, 0);
    group.add(light);
    // bench
    mesh(group, new THREE.BoxGeometry(1.5, 0.1, 0.45), wood, [-0.2, 0.55, 1.3]);
    for (const x of [-0.85, 0.45]) mesh(group, new THREE.BoxGeometry(0.1, 0.55, 0.4), wood, [x, 0.28, 1.3]);

    this.scene.add(group);
    this.props.push({ group, baseZ: -14, side: 1, kind: 'stall' });
  }

  /* ------------------------------------------------------------ obstacles */

  createBus() {
    const group = new THREE.Group();
    const label = pick(BUS_LABELS);
    const colors = [
      ['#1f7a4f', '#ffcf6e'],
      ['#b3263b', '#ffe0a3'],
      ['#265f9e', '#ffcf6e'],
      ['#7a2d7e', '#ffd166'],
    ];
    const [primary, secondary] = pick(colors);
    const tex = makeBusTexture(primary, secondary, label);
    const sideMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.58, metalness: 0.08 });
    const plain = std(primary, { roughness: 0.6 });
    const glass = std(0x17222c, { roughness: 0.25, metalness: 0.35 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.34, 2.5, 7.4), [sideMat, sideMat, plain, plain, plain, glass]);
    body.position.y = 1.72;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // roof rack
    mesh(group, new THREE.BoxGeometry(1.9, 0.16, 4.6), std(0x3a3038, { metalness: 0.4, roughness: 0.6 }), [0, 3.06, 0.2], [0, 0, 0], true);
    mesh(group, new THREE.BoxGeometry(0.12, 0.12, 4.4), std(0x2a2228), [-0.85, 3.16, 0.2]);
    mesh(group, new THREE.BoxGeometry(0.12, 0.12, 4.4), std(0x2a2228), [0.85, 3.16, 0.2]);

    // back window, route board and lights
    mesh(group, new THREE.PlaneGeometry(1.7, 0.9), std(0x131c26, { roughness: 0.2, metalness: 0.4 }), [0, 2.05, 3.716]);
    const routeTex = makeSignTexture('ঢাকা', { bg: '#10151e', fg: '#ffd166', accent: '#ff5a36' });
    const routeMat = new THREE.MeshStandardMaterial({ map: routeTex, emissiveMap: routeTex, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.5 });
    mesh(group, new THREE.PlaneGeometry(1.5, 0.46), routeMat, [0, 2.72, 3.72]);
    mesh(group, new THREE.BoxGeometry(2.2, 0.18, 0.16), std(0x2a2228, { metalness: 0.5, roughness: 0.5 }), [0, 0.68, 3.74]);
    for (const x of [-0.85, 0.85]) {
      mesh(group, new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff3a26, emissive: 0xff2a18, emissiveIntensity: 2.4 }), [x, 1.05, 3.72]);
    }
    // headlights
    for (const x of [-0.85, 0.85]) {
      mesh(group, new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff2c9, emissive: 0xffd27a, emissiveIntensity: 2.2 }), [x, 1.1, -3.72]);
    }
    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.3, 12);
    const wheelMat = std(0x141018, { roughness: 0.9 });
    for (const x of [-1.1, 1.1]) {
      for (const z of [-2.35, 2.3]) {
        mesh(group, wheelGeo, wheelMat, [x, 0.48, z], [0, 0, Math.PI / 2]);
      }
    }
    group.userData.type = 'bus';
    return { group, hx: 1.25, hz: 3.85, cy: 1.75, hy: 1.45, speedMul: rand(0.3, 0.44) };
  }

  createCNG() {
    const group = new THREE.Group();
    const green = std(0x1c8a5a, { roughness: 0.5, metalness: 0.15 });
    const yellow = std(0xe8b93c, { roughness: 0.55 });
    const glass = std(0x1a2630, { roughness: 0.25, metalness: 0.35 });
    mesh(group, new THREE.BoxGeometry(1.65, 1.0, 2.4), green, [0, 0.98, 0], [0, 0, 0], true);
    mesh(group, new THREE.BoxGeometry(1.55, 0.82, 1.3), green, [0, 1.72, 0.15], [0, 0, 0], true);
    mesh(group, new THREE.BoxGeometry(1.6, 0.16, 1.35), yellow, [0, 2.18, 0.15], [0, 0, 0], true);
    mesh(group, new THREE.PlaneGeometry(1.2, 0.5), glass, [0, 1.82, -0.51]);
    mesh(group, new THREE.PlaneGeometry(1.2, 0.46), glass, [0, 1.8, 0.81], [0, Math.PI, 0]);
    // front nose
    mesh(group, new THREE.BoxGeometry(1.2, 0.7, 0.7), green, [0, 0.78, -1.35], [0.18, 0, 0], true);
    for (const x of [-0.72, 0.72]) {
      mesh(group, new THREE.CylinderGeometry(0.32, 0.32, 0.2, 10), std(0x141018, { roughness: 0.9 }), [x, 0.34, 0.82], [0, 0, Math.PI / 2]);
    }
    mesh(group, new THREE.CylinderGeometry(0.3, 0.3, 0.18, 10), std(0x141018, { roughness: 0.9 }), [0, 0.32, -1.3], [0, 0, Math.PI / 2]);
    // headlight
    mesh(group, new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff2c9, emissive: 0xffd27a, emissiveIntensity: 2 }), [0, 0.95, -1.72]);
    group.userData.type = 'cng';
    return { group, hx: 0.9, hz: 1.55, cy: 1.1, hy: 1.12, speedMul: rand(0.26, 0.4) };
  }

  createCar() {
    const group = new THREE.Group();
    const colors = [0xd9d3c4, 0x2f4f7a, 0x8f2d3a, 0x3b6b5a, 0x6a5a78, 0xc27a32];
    const bodyMat = std(pick(colors), { roughness: 0.42, metalness: 0.25 });
    mesh(group, new THREE.BoxGeometry(1.8, 0.72, 3.8), bodyMat, [0, 0.76, 0], [0, 0, 0], true);
    mesh(group, new THREE.BoxGeometry(1.55, 0.62, 1.9), bodyMat, [0, 1.4, 0.15], [0, 0, 0], true);
    const glass = std(0x141e28, { roughness: 0.2, metalness: 0.4 });
    mesh(group, new THREE.PlaneGeometry(1.3, 0.44), glass, [0, 1.45, -0.81], [0, 0, 0]);
    mesh(group, new THREE.PlaneGeometry(1.3, 0.42), glass, [0, 1.44, 1.11], [0, Math.PI, 0]);
    for (const x of [-0.92, 0.92]) {
      for (const z of [-1.2, 1.2]) {
        mesh(group, new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10), std(0x141018, { roughness: 0.9 }), [x, 0.35, z], [0, 0, Math.PI / 2]);
      }
    }
    for (const x of [-0.62, 0.62]) {
      mesh(group, new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff3a26, emissive: 0xff2a18, emissiveIntensity: 2.2 }), [x, 0.78, 1.91]);
      mesh(group, new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff2c9, emissive: 0xffd27a, emissiveIntensity: 2 }), [x, 0.8, -1.91]);
    }
    group.userData.type = 'car';
    return { group, hx: 0.95, hz: 2.0, cy: 0.9, hy: 0.95, speedMul: rand(0.28, 0.42) };
  }

  createBarrier() {
    const group = new THREE.Group();
    const tex = makeBannerTexture('সাবধান', 'ROAD WORK');
    const plankMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide });
    mesh(group, new THREE.BoxGeometry(2.5, 0.62, 0.12), plankMat, [0, 0.78, 0], [0, 0, 0], true);
    const legMat = std(0x3a2d33, { metalness: 0.4, roughness: 0.6 });
    for (const x of [-1.05, 1.05]) {
      mesh(group, new THREE.BoxGeometry(0.1, 1.1, 0.1), legMat, [x, 0.55, 0], [0, 0, 0], true);
      mesh(group, new THREE.BoxGeometry(0.1, 0.1, 0.7), legMat, [x, 0.06, 0]);
    }
    // flashing light
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffb050, emissive: 0xff8a1e, emissiveIntensity: 3 }));
    beacon.position.set(1.05, 1.2, 0);
    group.add(beacon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color: 0xffa030, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.copy(beacon.position);
    halo.scale.set(0.8, 0.8, 1);
    group.add(halo);
    group.userData.type = 'barrier';
    return { group, hx: 1.28, hz: 0.35, cy: 0.6, hy: 0.6, speedMul: 0 };
  }

  createPothole() {
    const group = new THREE.Group();
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 18),
      new THREE.MeshStandardMaterial({ color: 0x08070b, roughness: 0.35, metalness: 0.3 })
    );
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.012;
    group.add(hole);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 16),
      new THREE.MeshStandardMaterial({ color: 0x3a4d66, roughness: 0.08, metalness: 0.7, transparent: true, opacity: 0.8 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0.05, 0.02, 0.1);
    water.scale.set(1.1, 0.7, 1);
    group.add(water);
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.1, 18), new THREE.MeshStandardMaterial({ color: 0x4a3d3a, roughness: 0.95, side: THREE.DoubleSide }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.011;
    group.add(rim);
    group.userData.type = 'pothole';
    return { group, hx: 0.95, hz: 0.95, cy: 0.05, hy: 0.05, speedMul: 0 };
  }

  createBannerObstacle() {
    const group = new THREE.Group();
    const poleMat = std(0x2c2329, { metalness: 0.5, roughness: 0.5 });
    for (const x of [-1.25, 1.25]) {
      mesh(group, new THREE.CylinderGeometry(0.055, 0.07, 2.6, 6), poleMat, [x, 1.3, 0], [0, 0, 0], true);
    }
    mesh(group, new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), poleMat, [0, 2.56, 0], [0, 0, Math.PI / 2], true);
    const tex = makeBannerTexture(pick(['ঈদ মোবারক', 'ধীরে চলুন', 'পথ চলতে সাবধান']), 'DHAKA CITY');
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide, emissive: 0x2a1a12, emissiveMap: tex, emissiveIntensity: 0.25 });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.62), mat);
    banner.position.set(0, 1.92, 0);
    group.add(banner);
    // hanging fringe
    for (let i = 0; i < 9; i++) {
      mesh(group, new THREE.SphereGeometry(0.035, 5, 4), std(0xffcf6e), [-1.05 + i * 0.26, 1.56, 0]);
    }
    group.userData.type = 'banner';
    return { group, hx: 1.28, hz: 0.22, cy: 1.92, hy: 0.37, speedMul: 0 };
  }

  createCow() {
    const group = new THREE.Group();
    const hide = std(pick([0xe8dcc4, 0xc9a884, 0x8a5a3a]), { roughness: 0.9 });
    const dark = std(0x4a3224, { roughness: 0.9 });
    mesh(group, new THREE.CapsuleGeometry(0.46, 0.9, 6, 10), hide, [0, 1.15, 0], [0, 0, Math.PI / 2], true).scale.set(1, 1, 0.9);
    mesh(group, new THREE.SphereGeometry(0.3, 10, 8), hide, [0, 1.38, -0.82]);
    mesh(group, new THREE.BoxGeometry(0.34, 0.2, 0.4), hide, [0, 1.2, -1.05]);
    mesh(group, new THREE.SphereGeometry(0.1, 6, 5), dark, [-0.13, 1.58, -0.88]);
    mesh(group, new THREE.SphereGeometry(0.1, 6, 5), dark, [0.13, 1.58, -0.88]);
    // horns
    for (const x of [-0.18, 0.18]) {
      mesh(group, new THREE.ConeGeometry(0.05, 0.32, 5), std(0xd8c9a8), [x, 1.72, -0.82], [0, 0, x > 0 ? -0.4 : 0.4]);
    }
    // legs
    for (const x of [-0.32, 0.32]) {
      for (const z of [-0.55, 0.55]) {
        mesh(group, new THREE.CylinderGeometry(0.08, 0.07, 0.78, 6), hide, [x, 0.39, z]);
      }
    }
    // tail
    mesh(group, new THREE.CylinderGeometry(0.03, 0.02, 0.8, 5), dark, [0, 1.2, 0.85], [0.5, 0, 0]);
    // patches
    mesh(group, new THREE.SphereGeometry(0.24, 8, 6), dark, [0.2, 1.3, 0.15]).scale.set(1, 0.7, 1.2);
    group.userData.type = 'cow';
    return { group, hx: 0.72, hz: 1.1, cy: 1.1, hy: 1.05, speedMul: rand(0.12, 0.24), drift: rand(-0.5, 0.5), driftDir: Math.random() < 0.5 ? -1 : 1 };
  }

  createObstacle(type) {
    switch (type) {
      case 'bus': return this.createBus();
      case 'cng': return this.createCNG();
      case 'car': return this.createCar();
      case 'barrier': return this.createBarrier();
      case 'pothole': return this.createPothole();
      case 'banner': return this.createBannerObstacle();
      case 'cow': return this.createCow();
      default: return this.createBarrier();
    }
  }

  acquireObstacle(type) {
    const pool = (this.pools[type] ||= []);
    if (pool.length) {
      const obj = pool.pop();
      obj.group.visible = true;
      this.scene.add(obj.group);
      return obj;
    }
    return this.createObstacle(type);
  }

  releaseObstacle(obj) {
    this.scene.remove(obj.group);
    obj.group.visible = false;
    (this.pools[obj.group.userData.type] ||= []).push(obj);
  }

  spawnObstacle(type, lane, z = SPAWN_Z) {
    const obj = this.acquireObstacle(type);
    obj.lane = lane;
    obj.x = LANES[lane];
    obj.z = z + rand(-2, 2);
    obj.baseZ = obj.z;
    obj.passed = false;
    obj.hit = false;
    obj.group.position.set(obj.x, 0, obj.z);
    obj.group.rotation.y = 0;
    if (type === 'cow') {
      obj.group.rotation.y = Math.PI / 2 + rand(-0.3, 0.3);
      obj.drift = 0;
    }
    this.obstacles.push(obj);
    return obj;
  }

  /* ---------------------------------------------------------- collectibles */

  createMango() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xffb52e, emissive: 0xff8a1e, emissiveIntensity: 0.65, roughness: 0.42, metalness: 0.08 })
    );
    body.scale.set(1, 1.22, 1);
    body.castShadow = true;
    group.add(body);
    // blush
    const blush = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xff6a2e, emissive: 0xff4a12, emissiveIntensity: 0.35, roughness: 0.5 })
    );
    blush.position.set(0.12, 0.08, 0.2);
    blush.scale.set(1, 0.9, 0.5);
    group.add(blush);
    // leaf
    const leaf = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.2),
      new THREE.MeshStandardMaterial({ map: this.mangoLeafTexture, transparent: true, side: THREE.DoubleSide, roughness: 0.7 })
    );
    leaf.position.set(0.08, 0.42, 0);
    leaf.rotation.set(0.5, 0.4, 0.5);
    group.add(leaf);
    // glow
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffb52e,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(1.5, 1.5, 1);
    group.add(glow);
    // halo ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.018, 5, 24),
      new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb040, emissiveIntensity: 1.4, roughness: 0.4 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    group.userData.ring = ring;
    return { group, ring };
  }

  acquireMango() {
    const pool = (this.pools.mango ||= []);
    if (pool.length) {
      const obj = pool.pop();
      obj.group.visible = true;
      this.scene.add(obj.group);
      return obj;
    }
    return this.createMango();
  }

  spawnMango(lane, z) {
    const obj = this.acquireMango();
    obj.lane = lane;
    obj.x = LANES[lane];
    obj.z = z;
    obj.baseZ = z;
    obj.phase = rand(0, Math.PI * 2);
    obj.collected = false;
    obj.group.position.set(obj.x, 1.15, z);
    this.mangoes.push(obj);
  }

  spawnMangoLine(lane, z = SPAWN_Z) {
    const count = 3 + ((Math.random() * 4) | 0);
    for (let i = 0; i < count; i++) this.spawnMango(lane, z - i * 4.6);
  }

  /* -------------------------------------------------------------- particles */

  buildParticles() {
    const count = 260;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.24,
      map: this.glowTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.particles = new THREE.Points(geometry, material);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
    this.particleData = Array.from({ length: count }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, x: 0, y: 0, z: 0 }));
    this.particleCursor = 0;
    this.particleColors = colors;
    this.particlePositions = positions;
  }

  burst(x, y, z, color, count = 16, power = 5) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const idx = this.particleCursor;
      this.particleCursor = (this.particleCursor + 1) % this.particleData.length;
      const p = this.particleData[idx];
      p.life = p.max = rand(0.45, 1.1);
      p.x = x + rand(-0.2, 0.2);
      p.y = y + rand(-0.2, 0.2);
      p.z = z + rand(-0.2, 0.2);
      p.vx = rand(-power, power);
      p.vy = rand(0.5, power);
      p.vz = rand(-power, power);
      this.particlePositions[idx * 3] = p.x;
      this.particlePositions[idx * 3 + 1] = p.y;
      this.particlePositions[idx * 3 + 2] = p.z;
      this.particleColors[idx * 3] = c.r;
      this.particleColors[idx * 3 + 1] = c.g;
      this.particleColors[idx * 3 + 2] = c.b;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  buildAmbient() {
    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rand(-20, 20);
      positions[i * 3 + 1] = rand(0.5, 12);
      positions[i * 3 + 2] = rand(-90, 20);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.ambient = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: 0xffd9a8,
      size: 0.09,
      map: this.glowTexture,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.ambient.frustumCulled = false;
    this.scene.add(this.ambient);
  }

  /* ---------------------------------------------------------------- spawner */

  spawnInitial() {
    this.spawnMangoLine(1, -32);
    this.spawnObstacle('bus', 0, -42);
    this.spawnObstacle('car', 2, -70);
    this.spawnObstacle('pothole', 0, -96);
    this.spawnObstacle('barrier', 1, -122);
  }

  destroyObstacle(obj) {
    const idx = this.obstacles.indexOf(obj);
    if (idx >= 0) this.obstacles.splice(idx, 1);
    this.releaseObstacle(obj);
  }

  spawnWave() {
    const speed = this.speed;
    const difficulty = clamp((speed - 14) / 24, 0, 1);
    this.waveIndex++;

    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    let count = Math.random() < 0.56 ? 1 : 2;
    if (difficulty < 0.12) count = 1;
    if (difficulty > 0.72 && Math.random() < 0.18) count = 2;
    if (difficulty < 0.25 && this.waveIndex < 3) count = 1;

    const typeWeights = [
      ['pothole', 16],
      ['barrier', 14],
      ['bus', 16],
      ['cng', 15],
      ['car', 15],
      ['cow', 10],
      ['banner', 12],
    ];
    const totalWeight = typeWeights.reduce((a, [, w]) => a + w, 0);

    const chosen = lanes.slice(0, count);
    for (const lane of chosen) {
      let roll = Math.random() * totalWeight;
      let type = 'barrier';
      for (const [t, w] of typeWeights) {
        roll -= w;
        if (roll <= 0) { type = t; break; }
      }
      // banners need a little breathing room early on
      if (type === 'banner' && this.waveIndex < 4) type = 'car';
      this.spawnObstacle(type, lane);
    }

    const freeLane = lanes[count] ?? lanes[0];
    if (Math.random() < 0.78) this.spawnMangoLine(freeLane);
  }

  /* ----------------------------------------------------------------- update */

  update(dt, { speed, playerX, playerY, playerHeight, boosting = false, active = true }) {
    this.time += dt;
    this.speed = speed;
    const scroll = speed * dt;

    // road motion
    this.roadTexture.offset.y -= scroll / 24;
    this.sidewalkTexture.offset.y -= scroll / 16;

    // city scroll + recycle
    for (const b of this.city) {
      b.group.position.z += scroll;
      if (b.group.position.z > 52) {
        b.group.position.z -= CITY_SPAN;
        b.group.position.x = b.side * (9.6 + rand(3.5, 7.5));
      }
    }

    // props scroll + recycle
    for (const p of this.props) {
      p.group.position.z += scroll;
      if (p.group.position.z > 46) {
        p.group.position.z -= CITY_SPAN;
        p.group.position.x = p.side * (p.kind === 'tree' ? rand(9.1, 10.4) : p.kind === 'stall' ? 8.4 : 8.5);
        if (p.kind === 'cow') p.group.rotation.y = rand(0, Math.PI * 2);
      }
    }

    for (const w of this.wires) {
      w.group.position.z += scroll;
      if (w.group.position.z > 42) w.group.position.z -= 252;
    }

    // clouds drift
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 1.4;
      if (cloud.position.x > 320) cloud.position.x = -320;
    }

    // neon flicker
    for (let i = 0; i < this.neonMats.length; i += 3) {
      const m = this.neonMats[i];
      m.emissiveIntensity = 1.05 + Math.sin(this.time * 3 + i) * 0.16 + (Math.random() < 0.008 ? -0.6 : 0);
    }

    // spawn
    if (active) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnWave();
        const base = 17 / Math.max(speed, 8);
        this.spawnTimer = base * rand(0.92, 1.35);
      }
    }

    // obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      const own = (o.speedMul ?? 1) * speed;
      o.z += (speed - own) * dt;
      if (o.group.userData.type === 'cow') {
        o.x += (o.drift ?? 0) * dt;
        if (Math.abs(o.x - LANES[o.lane]) > 0.55) o.drift *= -1;
      }
      o.group.position.z = o.z;
      o.group.position.x = o.x;

      // collision
      if (active && !o.hit && !o.passed) {
        const dx = Math.abs(o.x - playerX);
        if (Math.abs(o.z) < o.hz + 1.25 && dx < o.hx + 0.68) {
          const pTop = playerY + playerHeight;
          const pBottom = playerY;
          if (pBottom < o.cy + o.hy && pTop > o.cy - o.hy) {
            o.hit = true;
            this.callbacks.onHit?.(o);
          }
        }
      }

      if (active && !o.passed && o.z > 3.2) {
        o.passed = true;
        if (!o.hit && Math.abs(o.x - playerX) < 2.35 && Math.abs(o.x - playerX) > 0.95) {
          this.callbacks.onNearMiss?.(o);
        }
      }

      if (o.z > DESPAWN_Z) {
        this.releaseObstacle(o);
        this.obstacles.splice(i, 1);
      }
    }

    // mangoes
    for (let i = this.mangoes.length - 1; i >= 0; i--) {
      const m = this.mangoes[i];
      m.z += scroll;
      const bob = Math.sin(this.time * 3.4 + m.phase) * 0.12;
      m.group.position.set(m.x, 1.15 + bob, m.z);
      m.group.rotation.y += dt * 2.2;
      m.ring.rotation.z += dt * 3.4;
      if (active && !m.collected && Math.abs(m.z) < 1.7 && Math.abs(m.x - playerX) < 1.35 && playerY < 2.6) {
        m.collected = true;
        this.callbacks.onCollect?.(m);
        this.burst(m.x, 1.2, m.z, 0xffb52e, 14, 4.5);
        this.scene.remove(m.group);
        m.group.visible = false;
        (this.pools.mango ||= []).push(m);
        this.mangoes.splice(i, 1);
        continue;
      }
      if (m.z > DESPAWN_Z) {
        this.scene.remove(m.group);
        m.group.visible = false;
        (this.pools.mango ||= []).push(m);
        this.mangoes.splice(i, 1);
      }
    }

    // particles
    let anyParticle = false;
    for (let i = 0; i < this.particleData.length; i++) {
      const p = this.particleData[i];
      if (p.life <= 0) continue;
      anyParticle = true;
      p.life -= dt;
      p.vy -= 9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.life <= 0) {
        this.particlePositions[i * 3 + 1] = -100;
      } else {
        this.particlePositions[i * 3] = p.x;
        this.particlePositions[i * 3 + 1] = p.y;
        this.particlePositions[i * 3 + 2] = p.z;
      }
    }
    if (anyParticle) {
      this.particles.geometry.attributes.position.needsUpdate = true;
      this.particles.geometry.attributes.color.needsUpdate = true;
    }

    // ambient motes drift
    const pos = this.ambient.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let z = pos.getZ(i) + scroll * 0.35;
      if (z > 22) z -= 115;
      pos.setZ(i, z);
      pos.setY(i, pos.getY(i) + Math.sin(this.time + i) * dt * 0.08);
    }
    pos.needsUpdate = true;

    if (boosting) {
      // speed sparks near the rickshaw
      if (Math.random() < 0.6) {
        this.burst(rand(-3.4, 3.4), rand(0.2, 2.4), rand(4, 12), Math.random() > 0.5 ? 0xffcf6e : 0x26d3b4, 1, 2);
      }
    }
  }

  setNight(t) {
    const n = clamp(t, 0, 1);
    if (Math.abs(n - this.night) < 0.002) return;
    this.night = n;
    const top = new THREE.Color(0x241a44).lerp(new THREE.Color(0x0b0a1f), n);
    const horizon = new THREE.Color(0xff9d6c).lerp(new THREE.Color(0x7a3550), n);
    const bottom = new THREE.Color(0x4a2735).lerp(new THREE.Color(0x140d1c), n);
    this.skyMaterial.uniforms.topColor.value.copy(top);
    this.skyMaterial.uniforms.horizonColor.value.copy(horizon);
    this.skyMaterial.uniforms.bottomColor.value.copy(bottom);
    this.scene.fog.color.copy(horizon).lerp(new THREE.Color(0x3a2030), 0.35);
    this.sunLight.intensity = 2.45 - n * 1.5;
    this.hemi.intensity = 1.22 - n * 0.5;
    for (const mat of this.facadeMats) mat.emissiveIntensity = 0.65 + n * 1.4;
    this.sun.material.opacity = 0.55 - n * 0.45;
  }

  reset() {
    for (const o of this.obstacles) this.releaseObstacle(o);
    this.obstacles.length = 0;
    for (const m of this.mangoes) {
      this.scene.remove(m.group);
      m.group.visible = false;
      (this.pools.mango ||= []).push(m);
    }
    this.mangoes.length = 0;
    this.spawnTimer = 1.1;
    this.waveIndex = 0;
    this.night = -1;
    this.setNight(0);
    this.spawnInitial();
  }
}
