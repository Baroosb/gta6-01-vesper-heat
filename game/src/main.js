window.VB = window.VB || {};

VB.input = {
  keys: {},
  lookDX: 0,
  lookDY: 0,
  firing: false,
  _pressedCodes: new Set(),
  takeLook() {
    const dx = VB.input.lookDX;
    const dy = VB.input.lookDY;
    VB.input.lookDX = 0;
    VB.input.lookDY = 0;
    return { dx, dy };
  },
  pressed(code) {
    if (VB.input._pressedCodes.has(code)) {
      VB.input._pressedCodes.delete(code);
      return true;
    }
    return false;
  }
};

VB.save = {
  load() {
    try {
      const data = localStorage.getItem('vesper-heat-save-v1');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  store(obj) {
    try {
      localStorage.setItem('vesper-heat-save-v1', JSON.stringify(obj));
    } catch {}
  },
  clear() {
    try {
      localStorage.removeItem('vesper-heat-save-v1');
    } catch {}
  }
};

VB.raycast = function(origin, dir) {
  let nearestDist = Infinity;
  let nearestType = 'none';
  let nearestRef = null;
  let nearestPoint = null;

  const o = origin;
  const d = dir;

  // 1. Buildings from VB.city.colliders
  if (VB.city && VB.city.colliders && Array.isArray(VB.city.colliders)) {
    for (let i = 0; i < VB.city.colliders.length; i++) {
      const box = VB.city.colliders[i];
      const min = box.min || (box.box && box.box.min);
      const max = box.max || (box.box && box.box.max);
      if (!min || !max) continue;

      let tmin = (min.x - o.x) / (d.x !== 0 ? d.x : 0.00001);
      let tmax = (max.x - o.x) / (d.x !== 0 ? d.x : 0.00001);
      if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

      let tymin = (min.y - o.y) / (d.y !== 0 ? d.y : 0.00001);
      let tymax = (max.y - o.y) / (d.y !== 0 ? d.y : 0.00001);
      if (tymin > tymax) [tymin, tymax] = [tymax, tymin];

      if ((tmin > tymax) || (tymin > tmax)) continue;
      if (tymin > tmin) tmin = tymin;
      if (tymax < tmax) tmax = tymax;

      let tzmin = (min.z - o.z) / (d.z !== 0 ? d.z : 0.00001);
      let tzmax = (max.z - o.z) / (d.z !== 0 ? d.z : 0.00001);
      if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];

      if ((tmin > tzmax) || (tzmin > tmax)) continue;
      if (tzmin > tmin) tmin = tzmin;

      let t = tmin;
      if (t >= 0 && t <= 120 && t < nearestDist) {
        nearestDist = t;
        nearestType = 'building';
        nearestRef = box;
        nearestPoint = new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t);
      }
    }
  }

  // 2. Cars from VB.cars.all
  if (VB.cars && VB.cars.all && Array.isArray(VB.cars.all)) {
    for (let i = 0; i < VB.cars.all.length; i++) {
      const car = VB.cars.all[i];
      const cx = car.x !== undefined ? car.x : (car.position ? car.position.x : 0);
      const cz = car.z !== undefined ? car.z : (car.position ? car.position.z : 0);
      const cy = 0.8;
      const radius = 2.0;

      const ocx = cx - o.x;
      const ocy = cy - o.y;
      const ocz = cz - o.z;
      const tca = ocx * d.x + ocy * d.y + ocz * d.z;
      if (tca < 0) continue;
      const dsq = (ocx * ocx + ocy * ocy + ocz * ocz) - tca * tca;
      if (dsq > radius * radius) continue;
      const thc = Math.sqrt(radius * radius - dsq);
      let t = tca - thc;
      if (t < 0) t = tca + thc;
      if (t >= 0 && t < nearestDist) {
        nearestDist = t;
        nearestType = 'car';
        nearestRef = car;
        nearestPoint = new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t);
      }
    }
  }

  // 3. People from VB.people.all
  if (VB.people && VB.people.all && Array.isArray(VB.people.all)) {
    for (let i = 0; i < VB.people.all.length; i++) {
      const person = VB.people.all[i];
      const px = person.x !== undefined ? person.x : (person.position ? person.position.x : 0);
      const pz = person.z !== undefined ? person.z : (person.position ? person.position.z : 0);
      const py = 1.0;
      const radius = 0.55;

      const ocx = px - o.x;
      const ocy = py - o.y;
      const ocz = pz - o.z;
      const tca = ocx * d.x + ocy * d.y + ocz * d.z;
      if (tca < 0) continue;
      const dsq = (ocx * ocx + ocy * ocy + ocz * ocz) - tca * tca;
      if (dsq > radius * radius) continue;
      const thc = Math.sqrt(radius * radius - dsq);
      let t = tca - thc;
      if (t < 0) t = tca + thc;
      if (t >= 0 && t < nearestDist) {
        nearestDist = t;
        nearestType = 'person';
        nearestRef = person;
        nearestPoint = new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t);
      }
    }
  }

  if (nearestType === 'none') {
    return { type: 'none', ref: null, point: null, dist: Infinity };
  }
  return { type: nearestType, ref: nearestRef, point: nearestPoint, dist: nearestDist };
};

let audioInitialized = false;
function tryInitAudio() {
  if (!audioInitialized && VB.audio && typeof VB.audio.init === 'function') {
    audioInitialized = true;
    try {
      VB.audio.init();
    } catch (e) {}
  }
}

window.addEventListener('keydown', (e) => {
  tryInitAudio();
  VB.input.keys[e.code] = true;
  if (!e.repeat) {
    VB.input._pressedCodes.add(e.code);
  }
});

window.addEventListener('keyup', (e) => {
  VB.input.keys[e.code] = false;
});

window.addEventListener('mousedown', (e) => {
  tryInitAudio();
  if (e.button === 0) {
    VB.input.firing = true;
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    VB.input.firing = false;
  }
});

window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement) {
    VB.input.lookDX += e.movementX || 0;
    VB.input.lookDY += e.movementY || 0;
  }
});

function init() {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.5, 2000);

  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  const shotMode = !!shotName;

  const saved = VB.save.load();

  VB.world = {
    scene,
    camera,
    renderer,
    state: shotMode ? 'shot' : 'title',
    shotMode,
    time: 0,
    cash: saved && typeof saved.cash === 'number' ? saved.cash : 0,
    missionIndex: saved && typeof saved.missionIndex === 'number' ? saved.missionIndex : 0,
    setState(name) {
      VB.world.state = name;
      if (VB.hud && typeof VB.hud.refresh === 'function') {
        VB.hud.refresh();
      }
    },
    addCash(n) {
      VB.world.cash += n;
      const playerPos = (VB.player && VB.player.pos) ? VB.player.pos : { x: 0, z: 0, heading: 0 };
      VB.save.store({
        v: 1,
        cash: VB.world.cash,
        missionIndex: VB.world.missionIndex,
        playerPos: playerPos
      });
    },
    step(dt) {
      const clampedDt = Math.min(dt, 1 / 30);
      VB.world.time += clampedDt;
      if (VB.cars && typeof VB.cars.update === 'function') VB.cars.update(clampedDt);
      if (VB.people && typeof VB.people.update === 'function') VB.people.update(clampedDt);
      if (VB.player && typeof VB.player.update === 'function') VB.player.update(clampedDt);
      if (VB.police && typeof VB.police.update === 'function') VB.police.update(clampedDt);
      if (VB.missions && typeof VB.missions.update === 'function') VB.missions.update(clampedDt);
      if (VB.hud && typeof VB.hud.update === 'function') VB.hud.update(clampedDt);
    }
  };

  // Init modules in exact order
  if (VB.city && typeof VB.city.init === 'function') VB.city.init(scene);
  if (VB.scenery && typeof VB.scenery.init === 'function') VB.scenery.init(scene);
  if (VB.cars && typeof VB.cars.init === 'function') VB.cars.init(scene);
  if (VB.people && typeof VB.people.init === 'function') VB.people.init(scene);
  if (VB.player && typeof VB.player.init === 'function') VB.player.init(scene);
  if (VB.police && typeof VB.police.init === 'function') VB.police.init(scene);
  if (VB.missions && typeof VB.missions.init === 'function') VB.missions.init();
  if (VB.hud && typeof VB.hud.init === 'function') VB.hud.init();

  renderer.domElement.addEventListener('click', () => {
    tryInitAudio();
    if (VB.world.state === 'playing' && document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && VB.world.state === 'playing') {
      VB.world.setState('paused');
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let lastTime = performance.now();
  let firstFrame = true;

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if (firstFrame) {
      firstFrame = false;
      if (shotMode && VB.shots && typeof VB.shots.stage === 'function') {
        VB.shots.stage(shotName);
      }
    }

    if (VB.world.state === 'playing' || VB.world.state === 'shot') {
      VB.world.step(dt);
    } else {
      if (VB.hud && typeof VB.hud.update === 'function') {
        VB.hud.update(dt);
      }
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
