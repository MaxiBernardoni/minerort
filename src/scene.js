// ============================================================
// scene.js - Renderer, camaras y luces (sol/luna con sombras).
// ============================================================
import * as THREE from 'three';
import { CONFIG, CS } from './config.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: CONFIG.antialias, powerPreference: 'high-performance' });
renderer.autoClear = false;                       // dibujamos mundo y mano por separado
renderer.info.autoReset = false;                  // para contar llamadas/triangulos de todo el frame
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;            // el mapa de sombras se actualiza solo cuando hace falta (sky.js)
renderer.shadowMap.type = CONFIG.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
const shadow = { dirty: true };                   // dirty = true: hay que redibujar sombras ya (se rompio/puso un bloque)

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
const fogFar = () => (CONFIG.renderDistance - 1) * CS;   // se deriva de CONFIG, asi sigue al preset de calidad
scene.fog = new THREE.Fog(0xaad0ff, fogFar() * 0.45, fogFar());

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

// applyQuality (tecla K) vive en quality.js: necesita world.js y asi evitamos dependencias circulares.

export { canvas, renderer, scene, camera, handScene, handCamera, hemi, sun, shadow, fogFar, applyRenderScale, renderScale };
