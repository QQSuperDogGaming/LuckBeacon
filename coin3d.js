// coin3d.js — self-contained 3D coin with a flipTo(side) animation.
// No external build tools required. Uses Three.js from unpkg.

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createCoinScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();

  // camera
  const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 50);
  camera.position.set(0.6, 0.5, 1.5);

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(2.5, 3, 1.5);
  scene.add(dir);

  // materials
  const gold = new THREE.MeshPhysicalMaterial({
    color: '#caa64b', metalness: 1, roughness: 0.25, clearcoat: 0.3, clearcoatRoughness: 0.5
  });
  const headTint = new THREE.MeshPhysicalMaterial({
    color: '#f3d56b', metalness: 1, roughness: 0.3, clearcoat: 0.2
  });
  const tailTint = new THREE.MeshPhysicalMaterial({
    color: '#eec35a', metalness: 1, roughness: 0.35, clearcoat: 0.2
  });

  // coin geometry (simple, clean, export-free)
  const radius = 0.5, thickness = 0.08;

  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 96, 1, false), gold);
  scene.add(body);

  // rim torus for a nice edge highlight
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.98, 0.025, 24, 96), gold);
  rim.rotation.x = Math.PI / 2;
  body.add(rim);

  // heads/tails “relief” disks to catch specular
  const disk = new THREE.CircleGeometry(radius * 0.84, 64);

  const heads = new THREE.Mesh(disk, headTint);
  heads.position.y = thickness / 2 + 0.001;
  body.add(heads);

  const tails = new THREE.Mesh(disk, tailTint);
  tails.position.y = -thickness / 2 - 0.001;
  tails.rotation.x = Math.PI;
  body.add(tails);

  // gentle idle wobble
  let t = 0;
  let wobble = true;

  // resize handling
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  // render loop
  const clock = new THREE.Clock();
  function loop() {
    resize();
    const dt = clock.getDelta();
    if (wobble) {
      t += dt;
      body.rotation.x = Math.sin(t * 1.2) * 0.06;
      body.rotation.z = Math.cos(t * 0.9) * 0.04;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  // easing
  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

  // animate Y-rotation to a target side with N extra spins
  function flipTo(side = 'heads', { spins = 3, duration = 900 } = {}) {
    return new Promise((resolve) => {
      wobble = false; // pause idle while flipping

      // normalize current angle
      let start = body.rotation.y;
      const TAU = Math.PI * 2;
      start = start % TAU;

      const targetBase = side === 'heads' ? 0 : Math.PI;  // heads face camera at 0, tails at PI
      const end = targetBase + spins * TAU;

      const startTime = performance.now();

      function step(now) {
        const p = Math.min(1, (now - startTime) / duration);
        const k = easeOutCubic(p);
        body.rotation.y = start + (end - start) * k;

        // add a tiny squash/tilt flair
        body.rotation.x = Math.sin(k * Math.PI) * 0.25;

        if (p < 1) requestAnimationFrame(step);
        else {
          // snap cleanly and resume wobble
          body.rotation.y = targetBase;
          body.rotation.x = 0;
          wobble = true;
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  // expose a tiny API
  return {
    flipTo,
    setOrientation(side = 'heads') {
      body.rotation.y = side === 'heads' ? 0 : Math.PI;
    }
  };
}
