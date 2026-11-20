// ============================================================
// sky.js - Cielo con sol, luna y estrellas, nubes, ciclo de dia y noche.
// updateSky(dt) se llama en cada frame y ajusta cielo, niebla y luces.
// ============================================================

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { lerp, smooth, tn, waterTexture } from './textures.js';
import { scene, camera, renderer, sun, hemi, shadow, fogFar } from './scene.js';
import { waterMaterial, windUniform } from './world.js';

// ---------- Domo del cielo (shader) ----------
const skyUniforms = {
  uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uNight: { value: 0 }, uSunset: { value: 0 }, uTime: { value: 0 },
};
const skyMesh = new THREE.Mesh(
  new THREE.SphereGeometry(450, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false, transparent: true,
    vertexShader: `
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uTop, uHorizon, uSunDir;
      uniform float uNight, uSunset, uTime;
      float hash(vec3 p) { p = fract(p * 0.3183099 + vec3(.1, .2, .3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(uHorizon, uTop, pow(max(d.y, 0.0), 0.55));
        float sd = dot(d, uSunDir);
        col += vec3(1.0, 0.55, 0.25) * pow(max(sd, 0.0), 6.0) * uSunset * 0.6;      // resplandor del atardecer
        col = mix(col, vec3(1.0, 0.96, 0.8), smoothstep(0.9986, 0.9990, sd));        // sol
        col += vec3(1.0, 0.9, 0.6) * pow(max(sd, 0.0), 180.0) * 0.4;                 // halo
        float md = dot(d, -uSunDir);
        col = mix(col, vec3(0.9, 0.93, 1.0), smoothstep(0.9990, 0.9994, md) * uNight); // luna
        vec3 sp = floor(d * 180.0);                                                   // estrellas
        float tw = 0.65 + 0.35 * sin(uTime * 2.0 + hash(sp + 7.0) * 40.0);
        col += vec3(step(0.9972, hash(sp)) * tw) * uNight * smoothstep(0.0, 0.25, d.y);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
);
skyMesh.renderOrder = -10;
skyMesh.frustumCulled = false;
scene.add(skyMesh);

// ---------- Nubes (plano con mascara de ruido que se desliza) ----------
const CLOUD_SIZE = 1536, CLOUD_CELLS = 64, CLOUD_PX = 12;     // cada pixel de la mascara = 12 bloques
const cloudRepeat = CLOUD_SIZE / (CLOUD_CELLS * CLOUD_PX);
const cloudTexture = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = CLOUD_CELLS;
  const ctx = c.getContext('2d'), img = ctx.createImageData(CLOUD_CELLS, CLOUD_CELLS);
  for (let y = 0; y < CLOUD_CELLS; y++) for (let x = 0; x < CLOUD_CELLS; x++) {
    const n = tn(x, y, 6, 900, CLOUD_CELLS) * 0.65 + tn(x, y, 12, 901, CLOUD_CELLS) * 0.35;
    const i = (y * CLOUD_CELLS + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = n > 0.56 ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.repeat.set(cloudRepeat, cloudRepeat);
  return t;
})();
const cloudMaterial = new THREE.MeshBasicMaterial({
  map: cloudTexture, transparent: true, opacity: 0.88, depthWrite: false, fog: false, side: THREE.DoubleSide,
});
const clouds = new THREE.Mesh(new THREE.PlaneGeometry(CLOUD_SIZE, CLOUD_SIZE), cloudMaterial);
clouds.rotation.x = -Math.PI / 2;
clouds.renderOrder = -5;
clouds.frustumCulled = false;
scene.add(clouds);

// ---------- Ciclo de dia ----------
const sunDir = new THREE.Vector3(0, 1, 0);
const COL = {
  topDay: [0.20, 0.45, 0.88], topNight: [0.01, 0.015, 0.05],
  horDay: [0.68, 0.83, 0.98], horNight: [0.03, 0.04, 0.09], sunset: [1.0, 0.52, 0.28],
  hemiSkyDay: [0.78, 0.88, 1.0], hemiSkyNight: [0.34, 0.42, 0.70],
  hemiGndDay: [0.55, 0.50, 0.42], hemiGndNight: [0.10, 0.10, 0.14],
};
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
let dayT = CONFIG.startTime;
let daylight = 1;               // 0.18 (noche) .. 1 (dia): lo usan mano, particulas, agua
let skyTime = 0, shadowTick = 0;
const _lightPos = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();

function setTime(t) { dayT = ((t % 1) + 1) % 1; }
function skipTime() { setTime(dayT + 0.125); }
function clockString() {
  const hours = (dayT * 24 + 6) % 24;
  const h = Math.floor(hours), m = Math.floor((hours - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function updateSky(dt) {
  dayT = (dayT + dt / CONFIG.dayLength) % 1;
  skyTime += dt;
  const ang = dayT * Math.PI * 2;
  sunDir.set(Math.cos(ang), Math.sin(ang), 0.28).normalize();
  const e = sunDir.y;
  const dayF = smooth(-0.12, 0.28, e);
  const sunset = Math.exp(-Math.pow(e / 0.2, 2));
  daylight = 0.18 + 0.82 * dayF;

  // colores del cielo y la niebla
  const top = mix3(COL.topNight, COL.topDay, dayF);
  const hor = mix3(mix3(COL.horNight, COL.horDay, dayF), COL.sunset, sunset * 0.7);
  skyUniforms.uTop.value.setRGB(...top);
  skyUniforms.uHorizon.value.setRGB(...hor);
  skyUniforms.uSunDir.value.copy(sunDir);
  skyUniforms.uNight.value = 1 - smooth(-0.2, 0.1, e);
  skyUniforms.uSunset.value = sunset;
  skyUniforms.uTime.value = skyTime;
  skyMesh.position.copy(camera.position);
  scene.fog.color.setRGB(...hor);
  scene.fog.near = fogFar() * 0.45; scene.fog.far = fogFar();
  renderer.setClearColor(scene.fog.color);

  // sol de dia, luna de noche (una sola luz direccional)
  const useSun = e > -0.08;
  const L = useSun ? sunDir.clone() : sunDir.clone().negate();
  L.y = Math.max(L.y, 0.25); L.normalize();                      // evita sombras infinitas al amanecer
  sun.intensity = useSun ? 0.85 * smooth(-0.08, 0.3, e) : 0.22 * smooth(0.0, 0.3, -e);
  if (useSun) sun.color.setRGB(1, 0.97 - 0.25 * sunset, 0.92 - 0.45 * sunset);
  else sun.color.setRGB(0.55, 0.65, 1.0);
  hemi.intensity = lerp(0.8, 0.5, dayF);
  hemi.color.setRGB(...mix3(COL.hemiSkyNight, COL.hemiSkyDay, dayF));
  hemi.groundColor.setRGB(...mix3(COL.hemiGndNight, COL.hemiGndDay, dayF));

  // la camara de sombras sigue al jugador, alineada a la grilla de texeles (evita parpadeo)
  const t = _lightPos.set(camera.position.x, camera.position.y, camera.position.z);
  _f.copy(L).negate();
  _r.set(0, 1, 0).cross(_f).normalize();
  _u.crossVectors(_f, _r);
  const ts = 2 * CONFIG.shadowDistance / CONFIG.shadowMapSize;
  const a = Math.round(t.dot(_r) / ts) * ts, b = Math.round(t.dot(_u) / ts) * ts, c = t.dot(_f);
  sun.target.position.set(0, 0, 0).addScaledVector(_r, a).addScaledVector(_u, b).addScaledVector(_f, c);
  sun.position.copy(sun.target.position).addScaledVector(L, 120);
  sun.target.updateMatrixWorld();

  // materiales que dependen de la hora
  waterMaterial.color.setScalar(0.35 + 0.65 * dayF);
  waterTexture.offset.set(skyTime * 0.022, skyTime * 0.014);
  const cc = mix3(mix3([0.10, 0.11, 0.18], [1, 1, 1], dayF), [1.0, 0.72, 0.55], sunset * 0.45);
  cloudMaterial.color.setRGB(...cc);
  clouds.position.set(camera.position.x, CONFIG.cloudHeight, camera.position.z);
  const wind = skyTime * CONFIG.cloudSpeed / (CLOUD_CELLS * CLOUD_PX);
  cloudTexture.offset.set(camera.position.x * cloudRepeat / CLOUD_SIZE + wind, -camera.position.z * cloudRepeat / CLOUD_SIZE);
  windUniform.value = skyTime;

  // el mapa de sombras no se redibuja en todos los frames (es lo mas caro del render)
  shadowTick++;
  if (sun.castShadow && (shadow.dirty || shadowTick % Math.max(1, CONFIG.shadowUpdateEvery) === 0)) {
    renderer.shadowMap.needsUpdate = true;
    shadow.dirty = false;
  }
}

export { skyMesh, updateSky, daylight, dayT, setTime, skipTime, clockString };
