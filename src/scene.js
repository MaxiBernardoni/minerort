// ============================================================
// scene.js - Renderer, camaras y luces (sol/luna con sombras).
// ============================================================

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: CONFIG.antialias, powerPreference: 'high-performance' });
renderer.autoClear = false;                       // dibujamos mundo y mano por separado
renderer.info.autoReset = false;                  // para contar llamadas/triangulos de todo el frame
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;            // el mapa de sombras se actualiza solo cuando hace falta (sky.js)
renderer.shadowMap.type = CONFIG.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
let shadowDirty = true;                           // true = hay que redibujar sombras ya (se rompio/puso un bloque)

// Resolucion de render: 1 = nativa de la pantalla (hasta 2x). La baja el modo adaptativo.
const maxPixelRatio = Math.min(window.devicePixelRatio, 2);
let renderScale = 1;
function applyRenderScale(s) {
  renderScale = s;
  renderer.setPixelRatio(maxPixelRatio * s);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
renderer.setPixelRatio(maxPixelRatio);

const scene = new THREE.Scene();
let fogFar = (CONFIG.renderDistance - 1) * CS;
scene.fog = new THREE.Fog(0xaad0ff, fogFar * 0.45, fogFar);

const camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, 0.05, 500);
camera.rotation.order = 'YXZ';

// La mano se dibuja en otra escena encima de todo
const handScene = new THREE.Scene();
const handCamera = new THREE.PerspectiveCamera(55, 1, 0.01, 10);

// Luz ambiente (cielo/suelo) + luz direccional (sol o luna) que proyecta sombras
const hemi = new THREE.HemisphereLight(0xbfdcff, 0x8a7a60, 0.5);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.castShadow = CONFIG.shadows;
sun.shadow.mapSize.set(CONFIG.shadowMapSize, CONFIG.shadowMapSize);
const sc = sun.shadow.camera;
sc.left = sc.bottom = -CONFIG.shadowDistance;
sc.right = sc.top = CONFIG.shadowDistance;
sc.near = 1; sc.far = 300;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect; camera.updateProjectionMatrix();
  handCamera.aspect = aspect; handCamera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Cambia de preset de calidad en caliente (tecla K)
function applyQuality(name) {
  const q = QUALITY[name];
  if (!q) return;
  const softChanged = CONFIG.shadowSoft !== q.shadowSoft;
  const leavesChanged = CONFIG.fancyLeaves !== q.fancyLeaves;
  const rdChanged = CONFIG.renderDistance !== q.renderDistance;
  Object.assign(CONFIG, q, { quality: name });

  sun.castShadow = CONFIG.shadows;
  sun.shadow.mapSize.set(CONFIG.shadowMapSize, CONFIG.shadowMapSize);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  sc.left = sc.bottom = -CONFIG.shadowDistance;
  sc.right = sc.top = CONFIG.shadowDistance;
  sc.updateProjectionMatrix();
  if (softChanged) {
    renderer.shadowMap.type = CONFIG.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  }
  if (rdChanged) {
    fogFar = (CONFIG.renderDistance - 1) * CS;
    genOffsets = null;                                  // world.js recalcula los radios
  }
  if (leavesChanged) for (const ch of chunks.values()) ch.meshed = false;   // rehacer mallas de a poco
  shadowDirty = true;
}
