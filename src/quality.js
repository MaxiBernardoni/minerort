// ============================================================
// quality.js - Cambia de preset de calidad en caliente (tecla K).
// Los presets estan en QUALITY (config.js).
// ============================================================
import * as THREE from 'three';
import { CONFIG, QUALITY } from './config.js';
import { renderer, scene, sun, shadow } from './scene.js';
import { chunks, resetLoadRadius } from './world.js';

function applyQuality(name) {
  const q = QUALITY[name];
  if (!q) return;
  const sc = sun.shadow.camera;
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
  if (rdChanged) resetLoadRadius();                      // world.js recalcula los radios (la niebla sale de CONFIG)
  if (leavesChanged) for (const ch of chunks.values()) ch.meshed = false;   // rehacer mallas de a poco
  shadow.dirty = true;
}

export { applyQuality };
