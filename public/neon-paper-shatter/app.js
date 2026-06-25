import * as THREE from "./vendor/three.module.js";

const canvas = document.querySelector("#game-canvas");
const startPanel = document.querySelector("#start-panel");
const resultPanel = document.querySelector("#result-panel");
const hud = document.querySelector("#hud");
const inputEl = document.querySelector("#anxiety-input");
const startBtn = document.querySelector("#start-btn");
const sampleBtn = document.querySelector("#sample-btn");
const againBtn = document.querySelector("#again-btn");
const releasedCountEl = document.querySelector("#released-count");
const currentThoughtEl = document.querySelector("#current-thought");
const reframeListEl = document.querySelector("#reframe-list");

const WORLD = { w: 3800, d: 2600 };
const PLAYER_START = { x: 1500, z: 1420 };
const TWO_PI = Math.PI * 2;
const keys = new Set();
const pointer = { x: 0, y: 0, worldX: PLAYER_START.x + 360, worldZ: PLAYER_START.z - 120, down: false };
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tmpVec2 = new THREE.Vector2();
const tmpVec3 = new THREE.Vector3();
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angleTo = (from, to) => Math.atan2(to.z - from.z, to.x - from.x);
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

const weapons = [
  { id: "blade", name: "Moon Blade", color: "#9df7ff", cooldown: 0.18, damage: 1, range: 420, arc: 0.82 },
  { id: "lance", name: "Star Lance", color: "#ffd166", cooldown: 0.34, damage: 1, range: 620, arc: 0.28 },
  { id: "shredder", name: "Pixel Shredder", color: "#ff37c8", cooldown: 0.42, damage: 2, range: 360, arc: 1.18 },
];

const reframes = [
  "One piece at a time is still movement.",
  "This thought can be noticed without obeyed.",
  "You do not have to solve the whole sky tonight.",
  "A smaller next step is allowed.",
  "The feeling is real; the forecast is not final.",
  "You can return to the present and choose gently.",
  "This is a note, not a verdict.",
  "Pressure can become information, then motion.",
];

const monsterPlan = [
  { x: 1900, z: 1260, form: "loom", accent: "#b35cff", title: "Dread Bloom", scale: 1.48 },
  { x: 1200, z: 1180, form: "orb", accent: "#ff37c8", title: "What-If Orb", scale: 1.12 },
  { x: 2260, z: 1540, form: "glitch", accent: "#67e8ff", title: "Static Judge", scale: 1.12 },
  { x: 820, z: 1510, form: "mask", accent: "#ffd166", title: "Pressure Mask" },
  { x: 1580, z: 1780, form: "serpent", accent: "#8dffea", title: "Loop Serpent" },
  { x: 2860, z: 900, form: "tower", accent: "#ff6bd5", title: "Towering Maybe" },
  { x: 510, z: 720, form: "crawler", accent: "#9d78ff", title: "Creeping Deadline" },
  { x: 2930, z: 1840, form: "kite", accent: "#76a8ff", title: "Sharp Thought" },
];

const state = {
  mode: "menu",
  time: 0,
  total: 0,
  score: 0,
  weaponIndex: 0,
  reducedEffects: false,
  player: {
    x: PLAYER_START.x,
    z: PLAYER_START.z,
    y: 0,
    speed: 360,
    aim: -0.2,
    attackCooldown: 0,
    attackFlash: 0,
  },
  camera: { x: 0, z: 0 },
  anxieties: [],
  reframed: [],
  particles: [],
  slashes: [],
  charms: [],
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.setClearColor("#04020d", 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#090421");
scene.fog = new THREE.FogExp2("#120735", 0.00042);

const camera = new THREE.PerspectiveCamera(42, 16 / 9, 10, 7000);
const root = new THREE.Group();
const cityRoot = new THREE.Group();
const entityRoot = new THREE.Group();
const particleRoot = new THREE.Group();
const effectRoot = new THREE.Group();
scene.add(root);
root.add(cityRoot, entityRoot, particleRoot, effectRoot);

const ambient = new THREE.AmbientLight("#c9eaff", 1.65);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight("#d9f8ff", 1.85);
keyLight.position.set(-500, 1000, 800);
scene.add(keyLight);
const magentaLight = new THREE.PointLight("#ff37c8", 6.5, 2200, 1.7);
magentaLight.position.set(1250, 260, 1050);
scene.add(magentaLight);
const cyanLight = new THREE.PointLight("#67e8ff", 5.4, 2100, 1.7);
cyanLight.position.set(2350, 240, 1450);
scene.add(cyanLight);

const renderObjects = {
  player: null,
  monsters: new Map(),
  labels: new Map(),
  gridMaterials: [],
  skyGlyphs: [],
};

buildWorld();
buildPlayer();
resizeRenderer();
render();

function buildWorld() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.w + 2400, WORLD.d + 1800),
    new THREE.MeshStandardMaterial({
      color: "#0c0828",
      roughness: 0.62,
      metalness: 0.34,
      emissive: "#17004d",
      emissiveIntensity: 0.55,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(WORLD.w / 2, -8, WORLD.d / 2);
  root.add(floor);

  addGridLines();
  addNeonRoads();
  addBuildings();
  addFloatingGlyphs();
}

function addGridLines() {
  const major = new THREE.LineBasicMaterial({ color: "#ff37c8", transparent: true, opacity: 0.72 });
  const minor = new THREE.LineBasicMaterial({ color: "#55f4ff", transparent: true, opacity: 0.38 });
  renderObjects.gridMaterials.push(major, minor);

  const startX = -700;
  const endX = WORLD.w + 700;
  const startZ = -500;
  const endZ = WORLD.d + 900;
  for (let x = startX; x <= endX; x += 120) {
    const mat = Math.round(x / 120) % 5 === 0 ? major : minor;
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 1, startZ),
      new THREE.Vector3(x, 1, endZ),
    ]);
    cityRoot.add(new THREE.Line(geom, mat));
  }
  for (let z = startZ; z <= endZ; z += 120) {
    const mat = Math.round(z / 120) % 5 === 0 ? major : minor;
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(startX, 1.5, z),
      new THREE.Vector3(endX, 1.5, z),
    ]);
    cityRoot.add(new THREE.Line(geom, mat));
  }
}

function addNeonRoads() {
  const colors = ["#ff37c8", "#67e8ff", "#8d5cff"];
  for (let i = 0; i < 11; i += 1) {
    const mat = new THREE.LineBasicMaterial({
      color: colors[i % colors.length],
      transparent: true,
      opacity: 0.78,
    });
    renderObjects.gridMaterials.push(mat);
    const x = 160 + i * 360;
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 4, -360),
      new THREE.Vector3(x + 520, 4, WORLD.d + 680),
    ]);
    cityRoot.add(new THREE.Line(geom, mat));
  }
}

function addBuildings() {
  const colors = ["#ff37c8", "#67e8ff", "#8d5cff", "#ffd166"];
  const rows = [
    { z: 360, offset: 0 },
    { z: 700, offset: 130 },
    { z: 2140, offset: -120, sideOnly: true },
    { z: 2420, offset: 280, sideOnly: true },
  ];
  for (const row of rows) {
    for (let i = -2; i < 15; i += 1) {
      const w = 120 + ((i * 41 + row.z) % 110);
      const h = 250 + ((i * 73 + row.z) % 360);
      const d = 52 + ((i * 29 + row.z) % 60);
      const x = i * 300 + row.offset;
      const z = row.z + ((i * 37) % 90);
      const color = colors[Math.abs(i + row.z) % colors.length];
      if (row.sideOnly && x > 620 && x < 3060) continue;
      addBuilding(x, z, w, h, d, color);
    }
  }
}

function addBuilding(x, z, w, h, d, color) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: "#08051f",
      roughness: 0.6,
      metalness: 0.18,
      transparent: true,
      opacity: 0.12,
      emissive: "#090027",
      emissiveIntensity: 0.38,
      depthWrite: false,
    }),
  );
  body.position.set(x, h / 2, z);
  cityRoot.add(body);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.92 }),
  );
  edges.position.copy(body.position);
  cityRoot.add(edges);

  const signMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
  for (let y = 50; y < h - 30; y += 54) {
    if (Math.random() < 0.34) continue;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * rand(0.14, 0.32), 9), signMat.clone());
    sign.position.set(x + rand(-w * 0.25, w * 0.25), y, z - d / 2 - 1);
    sign.material.opacity = rand(0.45, 0.9);
    cityRoot.add(sign);
  }
}

function addFloatingGlyphs() {
  const glyphs = [
    { text: "A", x: 1780, y: 840, z: 480, color: "#fff8ff", scale: 260 },
    { text: "?", x: 820, y: 410, z: 870, color: "#ff37c8", scale: 78 },
    { text: "*", x: 2540, y: 500, z: 990, color: "#ffd166", scale: 86 },
    { text: "+", x: 3050, y: 350, z: 1420, color: "#67e8ff", scale: 74 },
  ];
  for (const g of glyphs) {
    const sprite = makeTextSprite(g.text, {
      color: g.color,
      glow: g.color,
      font: "900 150px Arial",
      width: 256,
      height: 256,
      stroke: "rgba(255,255,255,.12)",
      strokeWidth: 4,
    });
    sprite.position.set(g.x, g.y, g.z);
    sprite.scale.set(g.scale, g.scale, 1);
    sprite.material.opacity = g.text === "A" ? 0.9 : 0.78;
    cityRoot.add(sprite);
    renderObjects.skyGlyphs.push(sprite);
  }
}

function buildPlayer() {
  const group = new THREE.Group();
  const glow = makeGlowSprite("#67e8ff", 256, 0.75);
  glow.scale.set(190, 190, 1);
  glow.position.set(0, 78, -5);
  group.add(glow);

  const hero = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeHeroTexture(),
    transparent: true,
    depthWrite: false,
  }));
  hero.scale.set(150, 176, 1);
  hero.position.set(0, 86, 0);
  group.add(hero);

  const weaponCore = new THREE.Mesh(
    new THREE.CapsuleGeometry(6, 82, 6, 12),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95 }),
  );
  weaponCore.rotation.z = Math.PI / 2;
  weaponCore.position.set(52, 93, 2);
  group.add(weaponCore);

  const weaponGlow = new THREE.Mesh(
    new THREE.CapsuleGeometry(10, 96, 6, 12),
    new THREE.MeshBasicMaterial({
      color: "#9df7ff",
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  weaponGlow.rotation.z = Math.PI / 2;
  weaponGlow.position.copy(weaponCore.position);
  group.add(weaponGlow);

  group.userData.hero = hero;
  group.userData.glow = glow;
  group.userData.weaponCore = weaponCore;
  group.userData.weaponGlow = weaponGlow;
  renderObjects.player = group;
  entityRoot.add(group);
  syncPlayerVisuals();
}

function startGame(lines) {
  resetRuntime();
  state.mode = "play";
  state.total = lines.length;
  state.anxieties = lines.map((text, index) => makeMonster(text, index));
  for (const monster of state.anxieties) addMonsterVisual(monster);
  startPanel.classList.add("hidden");
  resultPanel.classList.add("hidden");
  hud.classList.remove("hidden");
  updateHud();
  updateCamera(1);
  render();
}

function resetRuntime() {
  state.mode = "menu";
  state.total = 0;
  state.score = 0;
  state.weaponIndex = 0;
  state.time = 0;
  state.player.x = PLAYER_START.x;
  state.player.z = PLAYER_START.z;
  state.player.aim = -0.2;
  state.player.attackCooldown = 0;
  state.player.attackFlash = 0;
  state.anxieties = [];
  state.reframed = [];
  state.particles = [];
  state.slashes = [];
  state.charms = [];

  for (const object of [...entityRoot.children]) {
    if (object !== renderObjects.player) disposeObject(object);
  }
  entityRoot.clear();
  entityRoot.add(renderObjects.player);
  for (const object of [...particleRoot.children]) disposeObject(object);
  for (const object of [...effectRoot.children]) disposeObject(object);
  particleRoot.clear();
  effectRoot.clear();
  renderObjects.monsters.clear();
  renderObjects.labels.clear();
  syncPlayerVisuals();
}

function parseAnxieties(raw) {
  const out = [];
  const seen = new Set();
  for (const line of raw.split(/\n+/)) {
    const text = line.trim().replace(/\s+/g, " ");
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text.slice(0, 72));
  }
  return out.length ? out.slice(0, 8) : ["A vague heavy feeling", "The next hard thing", "The what-if loop"];
}

function makeMonster(text, index) {
  const plan = monsterPlan[index % monsterPlan.length];
  const hp = 3 + (index % 4);
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`,
    text,
    title: plan.title,
    form: plan.form,
    accent: plan.accent,
    x: plan.x + rand(-85, 85),
    z: plan.z + rand(-70, 70),
    y: 0,
    vx: rand(-18, 18),
    vz: rand(-18, 18),
    radius: (108 + Math.min(50, text.length * 0.68)) * (plan.scale || 1),
    hp,
    maxHp: hp,
    phase: index * 0.7,
    wobble: rand(0, TWO_PI),
    hit: 0,
    tear: 0,
    textureKey: "",
  };
}

function addMonsterVisual(monster) {
  const group = new THREE.Group();
  const glow = makeGlowSprite(monster.accent, 384, 0.78);
  glow.scale.set(monster.radius * 3, monster.radius * 2.4, 1);
  glow.position.set(0, monster.radius * 0.98, -10);
  group.add(glow);

  const body = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeMonsterTexture(monster),
    transparent: true,
    depthWrite: false,
  }));
  body.scale.set(monster.radius * 2.35, monster.radius * 2.35, 1);
  body.position.set(0, monster.radius * 0.95, 0);
  group.add(body);

  const label = makeTextSprite(monster.text.length > 27 ? `${monster.text.slice(0, 24)}...` : monster.text, {
    color: "#fff8ff",
    glow: monster.accent,
    font: "900 42px Arial",
    width: 720,
    height: 128,
    stroke: monster.accent,
    strokeWidth: 9,
  });
  label.position.set(0, monster.radius * 2.25, 2);
  label.scale.set(monster.radius * 2.3, monster.radius * 0.42, 1);
  group.add(label);

  const health = new THREE.Group();
  for (let i = 0; i < monster.maxHp; i += 1) {
    const pip = new THREE.Mesh(
      new THREE.SphereGeometry(7, 12, 8),
      new THREE.MeshBasicMaterial({ color: monster.accent, transparent: true, opacity: 0.94 }),
    );
    pip.position.set((i - (monster.maxHp - 1) / 2) * 20, 18, 5);
    health.add(pip);
  }
  group.add(health);

  group.userData.body = body;
  group.userData.glow = glow;
  group.userData.label = label;
  group.userData.health = health;
  renderObjects.monsters.set(monster.id, group);
  entityRoot.add(group);
  syncMonsterVisual(monster, true);
}

function syncPlayerVisuals() {
  const player = state.player;
  const group = renderObjects.player;
  if (!group) return;
  group.position.set(player.x, 0, player.z);
  group.rotation.y = -player.aim;
  const weapon = weapons[state.weaponIndex];
  group.userData.weaponCore.material.color.set("#ffffff");
  group.userData.weaponGlow.material.color.set(weapon.color);
  group.userData.weaponGlow.material.opacity = 0.35 + player.attackFlash * 0.34;
  group.userData.glow.material.color.set(weapon.color);
  group.userData.glow.material.opacity = 0.44 + player.attackFlash * 0.24;
  const pulse = 1 + Math.sin(state.time * 8) * 0.018 + player.attackFlash * 0.08;
  group.userData.hero.scale.set(150 * pulse, 176 * pulse, 1);
}

function syncMonsterVisual(monster, forceTexture = false) {
  const group = renderObjects.monsters.get(monster.id);
  if (!group) return;
  const bob = Math.sin(state.time * 2.1 + monster.phase) * 12;
  group.position.set(monster.x, 0, monster.z);
  group.scale.setScalar(1 + monster.hit * 0.08);
  group.userData.body.position.y = monster.radius * 0.95 + bob;
  group.userData.glow.position.y = monster.radius * 0.98 + bob * 0.8;
  group.userData.label.position.y = monster.radius * 2.25 + bob;
  group.userData.glow.material.opacity = 0.48 + monster.hit * 0.34 + Math.sin(state.time * 5 + monster.phase) * 0.06;

  const health = group.userData.health;
  health.position.y = monster.radius * 0.22 + bob;
  for (let i = 0; i < health.children.length; i += 1) {
    health.children[i].material.opacity = i < monster.hp ? 0.96 : 0.18;
  }

  const textureKey = `${monster.hp}:${monster.tear.toFixed(1)}:${monster.hit > 0.01 ? 1 : 0}`;
  if (forceTexture || textureKey !== monster.textureKey) {
    monster.textureKey = textureKey;
    const oldMap = group.userData.body.material.map;
    group.userData.body.material.map = makeMonsterTexture(monster);
    group.userData.body.material.needsUpdate = true;
    oldMap?.dispose?.();
  }
}

function update(dt) {
  state.time += dt;
  const player = state.player;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.attackFlash = Math.max(0, player.attackFlash - dt * 5.5);

  if (state.mode === "play") {
    updatePlayer(dt);
    updateMonsters(dt);
  }

  updateSlashes(dt);
  updateParticles(dt);
  updateCharms(dt);
  updateCamera(dt);
  syncPlayerVisuals();
  for (const monster of state.anxieties) syncMonsterVisual(monster);
  animateWorld();
}

function updatePlayer(dt) {
  const player = state.player;
  let dx = 0;
  let dz = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dz -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dz += 1;
  const mag = Math.hypot(dx, dz) || 1;
  player.x = clamp(player.x + (dx / mag) * player.speed * dt, 120, WORLD.w - 120);
  player.z = clamp(player.z + (dz / mag) * player.speed * dt, 120, WORLD.d - 120);

  const pointerAngle = Math.atan2(pointer.worldZ - player.z, pointer.worldX - player.x);
  if (pointer.down || dx || dz) player.aim = pointer.down ? pointerAngle : Math.atan2(dz || Math.sin(player.aim), dx || Math.cos(player.aim));
  else player.aim += angleDelta(pointerAngle, player.aim) * Math.min(1, dt * 8);
  if (pointer.down) attack();
}

function updateMonsters(dt) {
  const player = state.player;
  for (const monster of state.anxieties) {
    monster.wobble += dt * (1.55 + monster.phase * 0.1);
    const away = Math.atan2(monster.z - player.z, monster.x - player.x);
    const d = distXZ(monster, player);
    if (d < 320) {
      monster.vx += Math.cos(away) * 110 * dt;
      monster.vz += Math.sin(away) * 110 * dt;
    } else if (d > 720) {
      monster.vx += Math.cos(away + Math.PI) * 18 * dt;
      monster.vz += Math.sin(away + Math.PI) * 18 * dt;
    }
    monster.x = clamp(monster.x + monster.vx * dt + Math.cos(monster.wobble) * 12 * dt, 90, WORLD.w - 90);
    monster.z = clamp(monster.z + monster.vz * dt + Math.sin(monster.wobble * 1.3) * 10 * dt, 90, WORLD.d - 90);
    monster.vx *= Math.max(0, 1 - dt * 1.45);
    monster.vz *= Math.max(0, 1 - dt * 1.45);
    monster.hit = Math.max(0, monster.hit - dt * 4.2);
  }
}

function updateSlashes(dt) {
  for (const slash of state.slashes) {
    slash.age += dt;
    const t = 1 - slash.age / slash.life;
    slash.object.material.opacity = Math.max(0, slash.opacity * t);
    slash.object.scale.set(slash.scaleX * (1 + slash.age * 1.4), slash.scaleY * (0.82 + t * 0.2), 1);
  }
  for (const slash of state.slashes.filter((s) => s.age >= s.life)) {
    effectRoot.remove(slash.object);
    disposeObject(slash.object);
  }
  state.slashes = state.slashes.filter((slash) => slash.age < slash.life);
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.age += dt;
    p.velocity.y -= 330 * dt;
    p.object.position.x += p.velocity.x * dt;
    p.object.position.y += p.velocity.y * dt;
    p.object.position.z += p.velocity.z * dt;
    p.object.rotation.x += p.spin.x * dt;
    p.object.rotation.y += p.spin.y * dt;
    p.object.rotation.z += p.spin.z * dt;
    p.object.material.opacity = Math.max(0, p.opacity * (1 - p.age / p.life));
  }
  for (const p of state.particles.filter((particle) => particle.age >= particle.life)) {
    particleRoot.remove(p.object);
    disposeObject(p.object);
  }
  state.particles = state.particles.filter((particle) => particle.age < particle.life);
}

function updateCharms(dt) {
  for (const charm of state.charms) {
    charm.age += dt;
    charm.object.position.y = 120 + Math.sin(state.time * 3 + charm.seed) * 20;
    charm.object.material.opacity = Math.min(0.9, charm.age * 1.5);
    charm.object.rotation.y += dt * 1.5;
  }
}

function updateCamera(dt) {
  const player = state.player;
  state.camera.x += (player.x - state.camera.x) * Math.min(1, dt * 4.5);
  state.camera.z += (player.z - state.camera.z) * Math.min(1, dt * 4.5);
  const desired = tmpVec3.set(state.camera.x - 520, 610, state.camera.z + 820);
  camera.position.lerp(desired, Math.min(1, dt * 5.2));
  camera.lookAt(state.camera.x + 210, 96, state.camera.z - 160);
}

function animateWorld() {
  for (let i = 0; i < renderObjects.gridMaterials.length; i += 1) {
    const mat = renderObjects.gridMaterials[i];
    mat.opacity = (i % 2 ? 0.28 : 0.48) + Math.sin(state.time * 1.8 + i) * 0.05;
  }
  for (let i = 0; i < renderObjects.skyGlyphs.length; i += 1) {
    const glyph = renderObjects.skyGlyphs[i];
    glyph.position.y += Math.sin(state.time * 0.8 + i) * 0.04;
    glyph.material.opacity = (i === 0 ? 0.84 : 0.62) + Math.sin(state.time * 2 + i) * 0.08;
  }
}

function attack() {
  if (state.mode !== "play" || state.player.attackCooldown > 0) return;
  const player = state.player;
  const weapon = weapons[state.weaponIndex];
  player.attackCooldown = weapon.cooldown;
  player.attackFlash = 1;
  player.aim = Math.atan2(pointer.worldZ - player.z, pointer.worldX - player.x);
  spawnSlash(player, weapon);

  for (const monster of [...state.anxieties]) {
    if (!weaponHits(weapon, monster)) continue;
    monster.hp -= weapon.damage;
    monster.hit = 1;
    monster.tear = Math.min(1, monster.tear + (weapon.id === "shredder" ? 0.35 : 0.22));
    monster.vx += Math.cos(player.aim) * (weapon.id === "shredder" ? 310 : 180);
    monster.vz += Math.sin(player.aim) * (weapon.id === "shredder" ? 310 : 180);
    spawnBurst(monster, weapon, weapon.id === "shredder" ? 76 : 42);
    spawnImpactHalo(monster, weapon.color);
    if (monster.hp <= 0) releaseMonster(monster);
  }
  updateHud();
}

function weaponHits(weapon, monster) {
  const player = state.player;
  const distance = distXZ(player, monster);
  if (distance > weapon.range + monster.radius * 0.6) return false;
  const toMonster = angleTo(player, monster);
  const delta = Math.abs(angleDelta(toMonster, player.aim));
  if (weapon.id === "shredder") return distance < weapon.range + monster.radius;
  return delta < weapon.arc || distance < monster.radius + 90;
}

function spawnSlash(player, weapon) {
  const slash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSlashTexture(weapon.id, weapon.color),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.92,
  }));
  const range = weapon.range;
  slash.position.set(
    player.x + Math.cos(player.aim) * (range * 0.46),
    118,
    player.z + Math.sin(player.aim) * (range * 0.46),
  );
  slash.material.rotation = -player.aim + (weapon.id === "blade" ? -0.25 : 0);
  const scaleY = weapon.id === "lance" ? 72 : weapon.id === "shredder" ? 220 : 180;
  slash.scale.set(range * 1.1, scaleY, 1);
  effectRoot.add(slash);
  state.slashes.push({
    object: slash,
    age: 0,
    life: weapon.id === "shredder" ? 0.72 : 0.46,
    opacity: 0.92,
    scaleX: range * 1.1,
    scaleY,
  });
}

function spawnBurst(monster, weapon, count) {
  const capped = state.reducedEffects ? Math.min(count, 18) : count;
  for (let i = 0; i < capped; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.36 ? monster.accent : weapon.color,
      transparent: true,
      opacity: rand(0.55, 0.95),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shard = new THREE.Mesh(new THREE.PlaneGeometry(rand(8, 26), rand(4, 18)), material);
    const a = playerAimSpread(weapon.id);
    const speed = rand(130, weapon.id === "shredder" ? 640 : 420);
    shard.position.set(monster.x + rand(-20, 20), rand(65, monster.radius * 1.6), monster.z + rand(-20, 20));
    shard.rotation.set(rand(0, TWO_PI), rand(0, TWO_PI), rand(0, TWO_PI));
    particleRoot.add(shard);
    state.particles.push({
      object: shard,
      velocity: new THREE.Vector3(Math.cos(a) * speed, rand(80, 460), Math.sin(a) * speed),
      spin: new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-14, 14)),
      age: 0,
      life: rand(0.45, 1.05),
      opacity: material.opacity,
    });
  }
}

function playerAimSpread(type) {
  const spread = type === "shredder" ? 1.1 : 0.65;
  return state.player.aim + rand(-spread, spread);
}

function spawnImpactHalo(monster, color) {
  const halo = makeGlowSprite(color, 384, 0.95);
  halo.position.set(monster.x, monster.radius, monster.z);
  halo.scale.set(monster.radius * 2.8, monster.radius * 2.8, 1);
  effectRoot.add(halo);
  state.slashes.push({
    object: halo,
    age: 0,
    life: 0.5,
    opacity: 0.85,
    scaleX: monster.radius * 2.8,
    scaleY: monster.radius * 2.8,
  });
}

function releaseMonster(monster) {
  state.score += 1;
  const reframe = reframes[(state.score + monster.text.length) % reframes.length];
  state.reframed.push({ original: monster.text, reframe });
  spawnCharm(monster, reframe);
  spawnBurst(monster, weapons[state.weaponIndex], state.reducedEffects ? 26 : 120);

  const visual = renderObjects.monsters.get(monster.id);
  if (visual) {
    entityRoot.remove(visual);
    disposeObject(visual);
    renderObjects.monsters.delete(monster.id);
  }
  state.anxieties = state.anxieties.filter((item) => item.id !== monster.id);
  if (!state.anxieties.length) completeSession();
}

function spawnCharm(monster) {
  const charm = makeTextSprite("✦", {
    color: "#fff8ff",
    glow: monster.accent,
    font: "900 150px Arial",
    width: 256,
    height: 256,
    stroke: monster.accent,
    strokeWidth: 5,
  });
  charm.position.set(monster.x, 120, monster.z);
  charm.scale.set(84, 84, 1);
  entityRoot.add(charm);
  state.charms.push({ object: charm, age: 0, seed: Math.random() * 20 });
}

function completeSession() {
  state.mode = "complete";
  hud.classList.add("hidden");
  resultPanel.classList.remove("hidden");
  reframeListEl.innerHTML = "";
  for (const item of state.reframed) {
    const div = document.createElement("div");
    div.textContent = `${item.original} -> ${item.reframe}`;
    reframeListEl.appendChild(div);
  }
}

function updateHud() {
  releasedCountEl.textContent = `${state.score} / ${state.total}`;
  const nearest = getNearestMonster();
  currentThoughtEl.textContent = nearest
    ? `${weapons[state.weaponIndex].name} -> ${nearest.text}`
    : `${weapons[state.weaponIndex].name} -> all monsters released`;
}

function getNearestMonster() {
  let best = null;
  let bestDistance = Infinity;
  for (const monster of state.anxieties) {
    const d = distXZ(monster, state.player);
    if (d < bestDistance) {
      best = monster;
      bestDistance = d;
    }
  }
  return best;
}

function setWeapon(index) {
  state.weaponIndex = clamp(index, 0, weapons.length - 1);
  updateHud();
}

function resetToMenu() {
  resetRuntime();
  startPanel.classList.remove("hidden");
  resultPanel.classList.add("hidden");
  hud.classList.add("hidden");
  updateHud();
  render();
}

function updatePointerFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  tmpVec2.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  tmpVec2.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(tmpVec2, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(floorPlane, hit)) {
    pointer.worldX = hit.x;
    pointer.worldZ = hit.z;
  }
  pointer.x = clientX - rect.left;
  pointer.y = clientY - rect.top;
}

function render() {
  renderer.render(scene, camera);
}

function loop() {
  const dt = Math.min(0.033, clock.getDelta() || 0);
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function resizeRenderer() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(640, Math.floor(rect.width || window.innerWidth));
  const height = Math.max(360, Math.floor(rect.height || window.innerHeight));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function makeHeroTexture() {
  const c = document.createElement("canvas");
  c.width = 384;
  c.height = 448;
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.shadowColor = "#67e8ff";
  g.shadowBlur = 24;

  g.fillStyle = "rgba(0,0,0,.36)";
  g.beginPath();
  g.ellipse(192, 390, 78, 28, 0, 0, TWO_PI);
  g.fill();

  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = "#76f7ff";
  g.lineWidth = 16;
  g.beginPath();
  g.moveTo(160, 290);
  g.lineTo(116, 374);
  g.moveTo(220, 292);
  g.lineTo(268, 366);
  g.stroke();

  g.strokeStyle = "#ff37c8";
  g.lineWidth = 15;
  g.beginPath();
  g.moveTo(116, 374);
  g.lineTo(75, 382);
  g.moveTo(268, 366);
  g.lineTo(308, 374);
  g.stroke();

  const hoodie = g.createLinearGradient(122, 104, 262, 330);
  hoodie.addColorStop(0, "#202070");
  hoodie.addColorStop(0.55, "#171849");
  hoodie.addColorStop(1, "#4b1675");
  g.fillStyle = hoodie;
  rounded(g, 112, 128, 160, 196, 42);
  g.fill();
  g.strokeStyle = "#8ffcff";
  g.lineWidth = 9;
  g.stroke();

  g.fillStyle = "#2c176b";
  rounded(g, 126, 190, 132, 106, 24);
  g.fill();
  g.strokeStyle = "#ff37c8";
  g.lineWidth = 7;
  g.stroke();

  g.shadowColor = "#ff37c8";
  g.shadowBlur = 22;
  g.strokeStyle = "#fff4ff";
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(175, 232);
  g.bezierCurveTo(148, 198, 102, 244, 192, 286);
  g.bezierCurveTo(282, 244, 236, 198, 209, 232);
  g.stroke();

  g.shadowColor = "transparent";
  g.fillStyle = "#0b0718";
  g.beginPath();
  g.arc(198, 102, 45, 0, TWO_PI);
  g.fill();
  g.fillStyle = "#05030c";
  g.beginPath();
  g.moveTo(132, 100);
  g.bezierCurveTo(156, 20, 244, 30, 278, 78);
  g.bezierCurveTo(272, 115, 220, 104, 190, 135);
  g.bezierCurveTo(169, 104, 150, 138, 132, 100);
  g.fill();
  g.strokeStyle = "#d9fbff";
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(132, 105);
  g.lineTo(266, 92);
  g.stroke();

  g.fillStyle = "#ff9a56";
  g.beginPath();
  g.arc(226, 116, 22, -1.25, 1.23);
  g.fill();

  return makeTexture(c);
}

function makeMonsterTexture(monster) {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 640;
  const g = c.getContext("2d");
  const accent = monster.accent;
  g.clearRect(0, 0, 640, 640);
  g.translate(320, 330);
  g.shadowColor = accent;
  g.shadowBlur = 36 + monster.hit * 28;
  const fill = g.createRadialGradient(-120, -160, 20, 0, 0, 330);
  fill.addColorStop(0, "#5330b4");
  fill.addColorStop(0.56, "#271061");
  fill.addColorStop(1, "#080313");
  g.fillStyle = fill;
  g.strokeStyle = accent;
  g.lineWidth = 14;
  g.lineJoin = "round";

  if (monster.form === "orb") drawOrb(g);
  else if (monster.form === "glitch") drawGlitch(g);
  else if (monster.form === "mask") drawMask(g);
  else if (monster.form === "serpent") drawSerpent(g, accent);
  else if (monster.form === "tower") drawTower(g);
  else if (monster.form === "crawler") drawCrawler(g);
  else if (monster.form === "kite") drawKite(g);
  else drawLoom(g);

  drawMonsterFace2d(g, accent, monster.form);
  drawScribbles2d(g, accent, monster.form);
  drawMonsterTears2d(g, monster);
  return makeTexture(c);
}

function drawLoom(g) {
  g.beginPath();
  g.moveTo(-220, -35);
  g.bezierCurveTo(-270, -240, -70, -340, 78, -248);
  g.bezierCurveTo(255, -306, 310, -45, 232, 130);
  g.bezierCurveTo(156, 280, -190, 255, -220, -35);
  g.fill();
  g.stroke();
}

function drawOrb(g) {
  g.beginPath();
  g.arc(0, -8, 206, 0, TWO_PI);
  g.fill();
  g.stroke();
  g.lineWidth = 11;
  g.globalAlpha = 0.8;
  g.beginPath();
  g.arc(0, -8, 145, -0.5, Math.PI * 1.25);
  g.stroke();
  g.globalAlpha = 1;
}

function drawGlitch(g) {
  g.beginPath();
  g.moveTo(-230, -84);
  g.lineTo(-128, -224);
  g.lineTo(62, -192);
  g.lineTo(238, -42);
  g.lineTo(190, 190);
  g.lineTo(-92, 170);
  g.lineTo(-236, 34);
  g.closePath();
  g.fill();
  g.stroke();
}

function drawMask(g) {
  g.beginPath();
  g.moveTo(0, -252);
  g.quadraticCurveTo(238, -126, 162, 132);
  g.quadraticCurveTo(0, 234, -162, 132);
  g.quadraticCurveTo(-238, -126, 0, -252);
  g.fill();
  g.stroke();
}

function drawSerpent(g, accent) {
  g.lineCap = "round";
  g.strokeStyle = "#23105f";
  g.lineWidth = 112;
  g.beginPath();
  g.moveTo(-226, 80);
  g.bezierCurveTo(-96, -210, 30, 190, 244, -62);
  g.stroke();
  g.strokeStyle = accent;
  g.lineWidth = 14;
  g.stroke();
}

function drawTower(g) {
  rounded(g, -145, -245, 290, 430, 32);
  g.fill();
  g.stroke();
}

function drawCrawler(g) {
  g.beginPath();
  g.ellipse(0, 10, 260, 126, 0, 0, TWO_PI);
  g.fill();
  g.stroke();
  g.lineWidth = 12;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      g.beginPath();
      g.moveTo(side * 70, 80);
      g.lineTo(side * (170 + i * 34), 126 + i * 28);
      g.stroke();
    }
  }
}

function drawKite(g) {
  g.beginPath();
  g.moveTo(0, -260);
  g.lineTo(236, -8);
  g.lineTo(0, 220);
  g.lineTo(-236, -8);
  g.closePath();
  g.fill();
  g.stroke();
}

function drawMonsterFace2d(g, accent, form) {
  g.save();
  g.shadowColor = accent;
  g.shadowBlur = 24;
  g.fillStyle = accent;
  const eyeY = form === "crawler" ? -8 : -54;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(side * 90, eyeY - 38);
    g.lineTo(side * 20, eyeY - 2);
    g.lineTo(side * 90, eyeY + 36);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = "#ffb4ff";
  g.lineWidth = 18;
  g.lineCap = "round";
  g.beginPath();
  for (let i = 0; i < 9; i += 1) {
    const x = -100 + i * 25;
    const y = 88 + (i % 2) * 44;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.restore();
}

function drawScribbles2d(g, accent, form) {
  g.save();
  g.globalAlpha = 0.86;
  g.strokeStyle = accent;
  g.lineWidth = 10;
  for (let i = 0; i < (form === "tower" ? 5 : 3); i += 1) {
    g.beginPath();
    g.ellipse(-70 + i * 70, -142 + Math.sin(i) * 18, 52, 24, i * 0.7, 0, TWO_PI);
    g.stroke();
  }
  g.strokeStyle = "rgba(0,0,0,.55)";
  g.lineWidth = 11;
  g.beginPath();
  g.moveTo(-80, -220);
  g.bezierCurveTo(-20, -150, -160, -100, 64, -34);
  g.bezierCurveTo(150, -6, 32, 32, 112, 104);
  g.stroke();
  g.restore();
}

function drawMonsterTears2d(g, monster) {
  if (monster.tear <= 0 && monster.hit <= 0) return;
  g.save();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = Math.max(monster.hit, monster.tear * 0.8);
  g.strokeStyle = "#ff9cff";
  g.shadowColor = "#ff37c8";
  g.shadowBlur = 28;
  g.lineWidth = 12;
  for (let i = 0; i < 6 + monster.tear * 12; i += 1) {
    const a = -0.8 + i * 0.28;
    g.beginPath();
    g.moveTo(Math.cos(a) * 36, Math.sin(a) * 28);
    g.lineTo(Math.cos(a) * (90 + monster.tear * 170), Math.sin(a) * (80 + monster.tear * 130));
    g.stroke();
  }
  g.restore();
}

function makeSlashTexture(type, color) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 384;
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.translate(60, 192);
  g.shadowColor = color;
  g.shadowBlur = 32;
  g.lineCap = "round";
  if (type === "lance") {
    const gradient = g.createLinearGradient(0, 0, 900, 0);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, "#ff37c8");
    g.strokeStyle = gradient;
    g.lineWidth = 34;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(900, 0);
    g.stroke();
    g.fillStyle = color;
    star2d(g, 900, 0, 54, 18, 5);
    g.fill();
  } else if (type === "shredder") {
    g.strokeStyle = color;
    g.lineWidth = 13;
    for (let i = 0; i < 15; i += 1) {
      g.save();
      g.rotate(-0.74 + i * 0.105);
      g.beginPath();
      g.moveTo(20, 0);
      g.lineTo(820 + i * 10, 0);
      g.stroke();
      g.restore();
    }
    g.strokeStyle = "#ffffff";
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(430, 0, 230, 108, 0, 0, TWO_PI);
    g.stroke();
  } else {
    g.strokeStyle = "#ffffff";
    g.lineWidth = 42;
    g.beginPath();
    g.moveTo(0, 56);
    g.quadraticCurveTo(360, -160, 820, 0);
    g.stroke();
    g.strokeStyle = color;
    g.lineWidth = 15;
    g.beginPath();
    g.moveTo(42, 84);
    g.quadraticCurveTo(390, 112, 830, 14);
    g.stroke();
  }
  return makeTexture(c);
}

function makeGlowSprite(color, size = 256, opacity = 0.7) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, color);
  grd.addColorStop(0.35, `${color}aa`);
  grd.addColorStop(1, `${color}00`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeTexture(c),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
}

function makeTextSprite(text, options) {
  const width = options.width || 512;
  const height = options.height || 160;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d");
  g.clearRect(0, 0, width, height);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = options.font || "900 72px Arial";
  g.shadowColor = options.glow || options.color;
  g.shadowBlur = 26;
  if (options.stroke) {
    g.strokeStyle = options.stroke;
    g.lineWidth = options.strokeWidth || 6;
    g.strokeText(text, width / 2, height / 2);
  }
  g.fillStyle = options.color || "#ffffff";
  g.fillText(text, width / 2, height / 2);
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeTexture(c),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
}

function makeTexture(canvasElement) {
  const texture = new THREE.CanvasTexture(canvasElement);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function rounded(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function star2d(g, x, y, outer, inner, points) {
  g.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 ? inner : outer;
    const angle = -Math.PI / 2 + (i / (points * 2)) * TWO_PI;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

function disposeObject(object) {
  object.traverse?.((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        mat.map?.dispose?.();
        mat.dispose?.();
      }
    }
  });
}

function renderGameToText() {
  return JSON.stringify({
    note: "Three.js world coordinates: x is left/right, z is depth, y is height. Player and monsters walk on y=0.",
    mode: state.mode,
    camera: {
      x: Math.round(camera.position.x),
      y: Math.round(camera.position.y),
      z: Math.round(camera.position.z),
    },
    player: {
      x: Math.round(state.player.x),
      z: Math.round(state.player.z),
      aim: Number(state.player.aim.toFixed(2)),
      attackCooldown: Number(state.player.attackCooldown.toFixed(2)),
    },
    weapon: weapons[state.weaponIndex].id,
    anxieties: state.anxieties.map((a) => ({
      text: a.text,
      x: Math.round(a.x),
      z: Math.round(a.z),
      hp: a.hp,
      form: a.form,
    })),
    score: state.score,
    total: state.total,
    particles: state.particles.length,
    charms: state.charms.length,
    reframed: state.reframed.length,
  });
}

startBtn.addEventListener("click", () => startGame(parseAnxieties(inputEl.value)));
sampleBtn.addEventListener("click", () => {
  inputEl.value = "What if I fail?\nI have too much to do\nPeople will judge me\nI am behind\nI do not know where to start";
  inputEl.focus();
});
againBtn.addEventListener("click", resetToMenu);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && state.mode === "play") {
    event.preventDefault();
    attack();
  } else if (event.code === "Digit1") setWeapon(0);
  else if (event.code === "Digit2") setWeapon(1);
  else if (event.code === "Digit3") setWeapon(2);
  else if (event.code === "KeyR" && state.mode === "complete") resetToMenu();
  else if (event.code === "KeyF") {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("resize", () => {
  resizeRenderer();
  render();
});

canvas.addEventListener("pointermove", (event) => {
  updatePointerFromClient(event.clientX, event.clientY);
});
canvas.addEventListener("pointerdown", (event) => {
  pointer.down = true;
  updatePointerFromClient(event.clientX, event.clientY);
  attack();
});
window.addEventListener("pointerup", () => {
  pointer.down = false;
});

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  render();
};
window.__set_reduced_effects = (value) => {
  state.reducedEffects = Boolean(value);
};
window.__test_attack_first = () => {
  if (state.mode !== "play" || !state.anxieties.length) return false;
  const target = state.anxieties[0];
  state.player.x = clamp(target.x - 210, 120, WORLD.w - 120);
  state.player.z = clamp(target.z + 105, 120, WORLD.d - 120);
  pointer.worldX = target.x;
  pointer.worldZ = target.z;
  state.player.aim = Math.atan2(target.z - state.player.z, target.x - state.player.x);
  state.player.attackCooldown = 0;
  updateCamera(1);
  syncPlayerVisuals();
  attack();
  render();
  return true;
};

updateCamera(1);
requestAnimationFrame(loop);
