window.VB = window.VB || {};

window.VB.cars = (function() {
  let all = [];
  let heroCar = null;
  let carIdCounter = 1;

  function createRandom(seed) {
    let s = seed | 0;
    return function() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = createRandom(20261118 + 101);
  const rngCars = rng;

  function createColoredBox(width, height, depth, hexColor) {
    const geom = new THREE.BoxGeometry(width, height, depth);
    const color = new THREE.Color(hexColor);
    const count = geom.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geom;
  }

  function createColoredCylinder(radiusTop, radiusBottom, height, radialSegments, hexColor) {
    const geom = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
    const color = new THREE.Color(hexColor);
    const count = geom.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geom;
  }

  function mergeGeometries(geos) {
    let posLen = 0, normLen = 0, colLen = 0, indexLen = 0;
    let hasIndex = false;
    for (const g of geos) {
      posLen += g.attributes.position.array.length;
      normLen += g.attributes.normal.array.length;
      if (g.attributes.color) colLen += g.attributes.color.array.length;
      if (g.index) {
        hasIndex = true;
        indexLen += g.index.array.length;
      }
    }
    const posArr = new Float32Array(posLen);
    const normArr = new Float32Array(normLen);
    const colArr = colLen > 0 ? new Float32Array(colLen) : null;
    const indArr = hasIndex ? new Uint32Array(indexLen) : null;

    let pOffset = 0, nOffset = 0, cOffset = 0, iOffset = 0, vertexOffset = 0;
    for (const g of geos) {
      const p = g.attributes.position.array;
      posArr.set(p, pOffset);
      pOffset += p.length;

      const n = g.attributes.normal.array;
      normArr.set(n, nOffset);
      nOffset += n.length;

      if (g.attributes.color && colArr) {
        const c = g.attributes.color.array;
        colArr.set(c, cOffset);
        cOffset += c.length;
      }

      if (g.index && indArr) {
        const ind = g.index.array;
        for (let i = 0; i < ind.length; i++) {
          indArr[iOffset++] = ind[i] + vertexOffset;
        }
      }
      vertexOffset += p.length / 3;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
    if (colArr) {
      merged.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    }
    if (indArr) {
      merged.setIndex(new THREE.BufferAttribute(indArr, 1));
    }
    return merged;
  }

  const headlightConeMat = new THREE.MeshBasicMaterial({
    color: 0xffe9b0,
    transparent: true,
    opacity: 0.10,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false
  });

  function makeCarMesh(kind, colorHex) {
    const group = new THREE.Group();
    const geos = [];

    const isPolice = (kind === 'police');
    const bodyColor = isPolice ? 0xffffff : colorHex;
    const trimColor = isPolice ? 0x222222 : 0x1a1a1a;
    const glassColor = 0x152233;
    const wheelColor = 0x1a1a1a;
    const headlightColor = 0xfff8d6;
    const taillightColor = 0xcc2222;

    function B(w, h, d, x, y, z, color) {
      const box = createColoredBox(w, h, d, color !== undefined ? color : bodyColor);
      box.translate(x, y, z);
      geos.push(box);
    }
    function G(w, h, d, x, y, z) {
      const box = createColoredBox(w, h, d, glassColor);
      box.translate(x, y, z);
      geos.push(box);
    }

    if (kind === 'sedan' || kind === 'police') {
      B(1.8, 0.6, 4.2, 0, 0.5, 0);
      G(1.6, 0.5, 2.0, 0, 1.05, -0.1);
      if (isPolice) {
        B(0.05, 0.55, 1.8, 0.91, 0.5, 0, trimColor);
        B(0.05, 0.55, 1.8, -0.91, 0.5, 0, trimColor);
      }
      B(1.7, 0.2, 0.2, 0, 0.35, -2.1, trimColor);
      B(1.7, 0.2, 0.2, 0, 0.35, 2.1, trimColor);
      B(0.3, 0.1, 0.05, 0.6, 0.4, -2.12, headlightColor);
      B(0.3, 0.1, 0.05, -0.6, 0.4, -2.12, headlightColor);
      B(0.3, 0.1, 0.05, 0.6, 0.4, 2.12, taillightColor);
      B(0.3, 0.1, 0.05, -0.6, 0.4, 2.12, taillightColor);
    } else if (kind === 'coupe') {
      B(1.8, 0.5, 4.2, 0, 0.45, 0);
      G(1.5, 0.45, 1.6, 0, 0.92, 0.2);
      B(1.7, 0.18, 0.2, 0, 0.33, -2.1, trimColor);
      B(1.7, 0.18, 0.2, 0, 0.33, 2.1, trimColor);
    } else if (kind === 'convertible') {
      B(1.8, 0.52, 4.3, 0, 0.46, 0);
      B(1.7, 0.3, 0.7, 0, 0.38, -2.2);
      G(1.6, 0.42, 0.07, 0, 0.95, -0.85);
      B(1.62, 0.22, 2.0, 0, 0.76, 0.35, 0x101014);
      B(0.55, 0.42, 0.55, -0.42, 0.88, 0.2, trimColor);
      B(0.55, 0.42, 0.55, 0.42, 0.88, 0.2, trimColor);
      B(0.55, 0.5, 0.14, -0.42, 1.02, 0.52, trimColor);
      B(0.55, 0.5, 0.14, 0.42, 1.02, 0.52, trimColor);
      B(1.5, 0.09, 0.09, 0, 1.12, 0.85, trimColor);
      B(1.7, 0.18, 0.2, 0, 0.33, -2.1, trimColor);
      B(1.7, 0.18, 0.2, 0, 0.33, 2.1, trimColor);
    } else if (kind === 'van') {
      B(2.0, 1.6, 5.0, 0, 1.0, 0);
      G(1.9, 0.6, 0.8, 0, 1.3, -2.1);
      B(1.9, 0.2, 0.2, 0, 0.3, -2.5, trimColor);
    } else if (kind === 'pickup') {
      B(1.8, 1.1, 2.2, 0, 0.75, -0.8);
      B(1.8, 0.6, 2.4, 0, 0.5, 1.2);
      B(1.7, 0.3, 0.1, 0, 0.5, 2.4, trimColor);
    } else if (kind === 'truck') {
      B(2.1, 0.3, 5.6, 0, 0.5, 0, 0x2a2d31);
      B(2.05, 1.3, 1.8, 0, 1.3, -1.85);
      G(1.9, 0.55, 0.08, 0, 1.55, -2.76);
      B(2.2, 2.1, 3.4, 0, 1.55, 0.95, 0xd6dade);
      B(2.24, 2.1, 0.1, 0, 1.55, 0.2, 0xb9bfc6);
      B(2.24, 2.1, 0.1, 0, 1.55, 0.95, 0xb9bfc6);
      B(2.24, 2.1, 0.1, 0, 1.55, 1.7, 0xb9bfc6);
      B(2.15, 0.28, 0.25, 0, 0.35, -2.85, trimColor);
      B(2.15, 0.28, 0.25, 0, 0.35, 2.85, trimColor);
      B(0.4, 0.18, 0.06, -0.7, 0.85, -2.78, 0xfff2b0);
      B(0.4, 0.18, 0.06, 0.7, 0.85, -2.78, 0xfff2b0);
      B(0.4, 0.18, 0.06, -0.85, 0.85, 2.72, 0xff3b30);
      B(0.4, 0.18, 0.06, 0.85, 0.85, 2.72, 0xff3b30);
    }

    let wheelR = 0.35, wheelZ = 1.3;
    if (kind === 'convertible') { wheelR = 0.35; wheelZ = 1.35; }
    else if (kind === 'van') { wheelR = 0.38; wheelZ = 1.6; }
    else if (kind === 'pickup') { wheelR = 0.4; wheelZ = 1.4; }
    else if (kind === 'truck') { wheelR = 0.48; wheelZ = 1.9; }
    const wheelX = (kind === 'truck') ? 1.02 : 0.95;

    const wheelPositions = [
      { x: wheelX, z: wheelZ }, { x: -wheelX, z: wheelZ },
      { x: wheelX, z: -wheelZ }, { x: -wheelX, z: -wheelZ }
    ];
    for (const wp of wheelPositions) {
      const wheel = createColoredCylinder(wheelR, wheelR, 0.3, 8, wheelColor);
      wheel.rotateZ(Math.PI / 2);
      wheel.translate(wp.x, wheelR, wp.z);
      geos.push(wheel);
    }

    const mergedGeom = mergeGeometries(geos);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 });
    const mesh = new THREE.Mesh(mergedGeom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const coneGeom = new THREE.CylinderGeometry(1.15, 0.14, 4.6, 10, 1, true);
    coneGeom.rotateX(-Math.PI / 2);
    const coneL = new THREE.Mesh(coneGeom, headlightConeMat);
    coneL.position.set(-0.6, kind === 'truck' ? 0.85 : 0.42, kind === 'truck' ? -5.3 : -4.45);
    coneL.visible = false;
    group.add(coneL);
    const coneR = new THREE.Mesh(coneGeom, headlightConeMat);
    coneR.position.set(0.6, kind === 'truck' ? 0.85 : 0.42, kind === 'truck' ? -5.3 : -4.45);
    coneR.visible = false;
    group.add(coneR);
    group.userData.headlightCones = [coneL, coneR];

    if (isPolice) {
      const lightBarGroup = new THREE.Group();
      const lbBoxL = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.15, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      lbBoxL.position.set(0.2, 1.45, 0);
      const lbBoxR = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.15, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x0000ff })
      );
      lbBoxR.position.set(-0.2, 1.45, 0);
      lightBarGroup.add(lbBoxL);
      lightBarGroup.add(lbBoxR);
      group.add(lightBarGroup);
      group.userData.lightBar = lightBarGroup;
    }

    return group;
  }

  function init(scene) {
    all.length = 0;
    heroCar = null;

    const civilianColors = [0x224488, 0x882222, 0x338833, 0x887722, 0x555555, 0x8844aa, 0xcc8833, 0x228888, 0xe2725b, 0x7fc8a9, 0xe8dcc0, 0x7fb2e5, 0xc45ba0, 0xf2e394];

    // 1. Spawn 18 traffic cars
    const roadLines = VB.city && VB.city.roadLines ? VB.city.roadLines : [];
    const kinds = ['sedan', 'coupe', 'van', 'pickup', 'convertible', 'truck'];

    for (let i = 0; i < 18; i++) {
      if (roadLines.length === 0) break;
      const rl = roadLines[Math.floor(rng() * roadLines.length)];
      const dir = rng() < 0.5 ? 1 : -1;
      const kind = kinds[Math.floor(rng() * kinds.length)];
      const color = civilianColors[Math.floor(rng() * civilianColors.length)];
      const targetSpeed = 9 + rng() * 4; // between trafficMinSpeed (9) and trafficMaxSpeed (13)

      let carX = 0, carZ = 0, heading = 0;
      const posOffset = (rng() - 0.5) * 400;

      if (rl.axis === 'z') {
        carX = rl.at + (dir === -1 ? 3.8 : -3.8);
        carZ = posOffset;
        heading = (dir === 1 ? Math.PI : 0);
      } else {
        carX = posOffset;
        carZ = rl.at + (dir === -1 ? 3.8 : -3.8);
        heading = (dir === 1 ? -Math.PI / 2 : Math.PI / 2);
      }

      const mesh = makeCarMesh(kind, color);
      mesh.position.set(carX, 0, carZ);
      mesh.rotation.y = heading;
      scene.add(mesh);

      const car = {
        id: carIdCounter++,
        kind,
        mesh,
        x: carX,
        z: carZ,
        heading,
        speed: targetSpeed,
        health: 100,
        isPlayer: false,
        isPolice: false,
        avenue: rl,
        dir,
        targetSpeed,
        parked: false,
        driverName: 'Civilian',
        drivenByPlayer: false,
        aiDriven: false,
        lightBar: mesh.userData.lightBar || null,
        cones: mesh.userData.headlightCones || null
      };
      all.push(car);
    }

    // 2. Spawn 22 parked cars at VB.city.parkSpots
    const parkSpots = VB.city && VB.city.parkSpots ? VB.city.parkSpots : [];
    for (let i = 0; i < Math.min(22, parkSpots.length); i++) {
      const spot = parkSpots[i];
      const kind = kinds[Math.floor(rng() * kinds.length)];
      const color = civilianColors[Math.floor(rng() * civilianColors.length)];

      const mesh = makeCarMesh(kind, color);
      mesh.position.set(spot.x, 0, spot.z);
      mesh.rotation.y = spot.heading || 0;
      scene.add(mesh);

      const car = {
        id: carIdCounter++,
        kind,
        mesh,
        x: spot.x,
        z: spot.z,
        heading: spot.heading || 0,
        speed: 0,
        health: 100,
        isPlayer: false,
        isPolice: false,
        avenue: null,
        dir: 1,
        targetSpeed: 0,
        parked: true,
        driverName: 'Parked',
        drivenByPlayer: false,
        aiDriven: false,
        lightBar: mesh.userData.lightBar || null,
        cones: mesh.userData.headlightCones || null
      };
      all.push(car);
    }

    // 3. Spawn hero's own car: teal sedan at the garage park spot
    const garageSpot = { x: 52, z: -60, heading: 0 };
    if (VB.landmarks && VB.landmarks.garage) {
      garageSpot.x = VB.landmarks.garage.x;
      garageSpot.z = VB.landmarks.garage.z;
    }
    const heroMesh = makeCarMesh('sedan', 0x228888);
    heroMesh.position.set(garageSpot.x, 0, garageSpot.z);
    heroMesh.rotation.y = 0;
    scene.add(heroMesh);

    heroCar = {
      id: carIdCounter++,
      kind: 'sedan',
      mesh: heroMesh,
      x: garageSpot.x,
      z: garageSpot.z,
      heading: 0,
      speed: 0,
      health: 100,
      isPlayer: true,
      isPolice: false,
      avenue: null,
      dir: 1,
      targetSpeed: 0,
      parked: false,
      driverName: 'Hero',
      drivenByPlayer: true,
      aiDriven: false,
      lightBar: heroMesh.userData.lightBar || null,
      cones: heroMesh.userData.headlightCones || null
    };
    all.push(heroCar);
  }

  function spawnScripted(spec) {
    const kind = spec.kind || 'sedan';
    const color = spec.color || 0xcccccc;
    let x = spec.x || 0;
    let z = spec.z || 0;
    let heading = spec.heading || 0;

    if (spec.atLandmark && VB.landmarks && VB.landmarks[spec.atLandmark]) {
      const lm = VB.landmarks[spec.atLandmark];
      x = lm.x;
      z = lm.z;
    }

    const mesh = makeCarMesh(kind, color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    VB.world.scene.add(mesh);

    const car = {
      id: carIdCounter++,
      kind,
      mesh,
      x,
      z,
      heading,
      speed: 0,
      health: 100,
      isPlayer: false,
      isPolice: (kind === 'police'),
      avenue: null,
      dir: 1,
      targetSpeed: 0,
      parked: true,
      driverName: 'Scripted',
      drivenByPlayer: false,
      aiDriven: (kind === 'police'),
      lightBar: mesh.userData.lightBar || null,
      cones: mesh.userData.headlightCones || null
    };
    all.push(car);
    return car;
  }

  function remove(car) {
    if (!car) return;
    if (car.mesh && car.mesh.parent) {
      car.mesh.parent.remove(car.mesh);
    }
    const idx = all.indexOf(car);
    if (idx !== -1) {
      all.splice(idx, 1);
    }
    if (car === heroCar) {
      heroCar = null;
    }
  }

  let fxReady = false;
  let fxTime = 0;
  let sparkPoints = null;
  let sparkPos = null;
  let sparkVel = null;
  let sparkLife = null;
  let sparkColors = null;
  const smokePool = [];
  let smokeTexture = null;
  const skidPool = [];
  let skidIndex = 0;

  function createSmokeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.5, 'rgba(200,200,200,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  function fxInit() {
    if (fxReady) return true;
    if (!VB.world || !VB.world.scene) return false;
    const scene = VB.world.scene;

    smokeTexture = createSmokeTexture();

    const sparkGeom = new THREE.BufferGeometry();
    sparkPos = new Float32Array(240 * 3);
    sparkVel = new Float32Array(240 * 3);
    sparkLife = new Float32Array(240);
    sparkColors = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      sparkPos[i * 3 + 1] = -999;
      sparkLife[i] = 0;
    }
    sparkGeom.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeom.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));

    const sparkMat = new THREE.PointsMaterial({
      size: 0.5,
      map: smokeTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });
    sparkPoints = new THREE.Points(sparkGeom, sparkMat);
    sparkPoints.frustumCulled = false;
    scene.add(sparkPoints);

    const spriteMatBase = new THREE.SpriteMaterial({
      map: smokeTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    for (let i = 0; i < 42; i++) {
      const mat = spriteMatBase.clone();
      const s = new THREE.Sprite(mat);
      s.visible = false;
      scene.add(s);
      smokePool.push({ s, life: 0, max: 1, rise: 1.4, grow: 1, baseOp: 0.3 });
    }

    const skidGeom = new THREE.PlaneGeometry(0.3, 1);
    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x08080a,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    for (let i = 0; i < 220; i++) {
      const mesh = new THREE.Mesh(skidGeom, skidMat);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      skidPool.push(mesh);
    }

    fxReady = true;
    return true;
  }

  const sparkPalette = [
    [1, 0.85, 0.4],
    [1, 0.6, 0.2],
    [1, 0.95, 0.7]
  ];

  function fxSparks(x, y, z, n) {
    if (!fxInit()) return;
    let spawned = 0;
    for (let i = 0; i < 240 && spawned < n; i++) {
      if (sparkLife[i] <= 0) {
        sparkPos[i * 3] = x;
        sparkPos[i * 3 + 1] = y;
        sparkPos[i * 3 + 2] = z;
        sparkVel[i * 3] = (rngCars() * 2 - 1) * 3.4;
        sparkVel[i * 3 + 1] = rngCars() * 3.6 + 0.6;
        sparkVel[i * 3 + 2] = (rngCars() * 2 - 1) * 3.4;
        sparkLife[i] = 0.35 + rngCars() * 0.25;
        const col = sparkPalette[Math.floor(rngCars() * sparkPalette.length)];
        sparkColors[i * 3] = col[0];
        sparkColors[i * 3 + 1] = col[1];
        sparkColors[i * 3 + 2] = col[2];
        spawned++;
      }
    }
  }

  function fxSmoke(x, y, z, opts) {
    if (!fxInit()) return;
    opts = opts || {};
    for (let i = 0; i < smokePool.length; i++) {
      const sp = smokePool[i];
      if (sp.life <= 0) {
        sp.s.position.set(x, y, z);
        const size = opts.size || 1;
        sp.s.scale.set(size, size, 1);
        if (opts.color !== undefined) {
          sp.s.material.color.setHex(opts.color);
        } else {
          sp.s.material.color.setHex(0x9aa0a8);
        }
        sp.max = opts.life || 1;
        sp.rise = opts.rise || 1.4;
        sp.grow = opts.size || 1;
        sp.baseOp = opts.opacity || 0.3;
        sp.life = sp.max;
        sp.s.material.opacity = sp.baseOp;
        sp.s.visible = true;
        break;
      }
    }
  }

  function fxSkid(x, z, heading, len) {
    if (!fxInit()) return;
    const mesh = skidPool[skidIndex % 220];
    skidIndex++;
    mesh.position.set(x, 0.045 + (skidIndex % 40) * 0.0004, z);
    mesh.rotation.y = heading;
    mesh.scale.set(1, len, 1);
    mesh.visible = true;
  }

  function fxExhaust(car) {
    if (!car._exhT) car._exhT = 0;
    if (fxTime - car._exhT < 0.07) return;
    car._exhT = fxTime;
    const exX = car.x + Math.sin(car.heading) * 2.2;
    const exZ = car.z + Math.cos(car.heading) * 2.2;
    fxSmoke(exX, 0.3, exZ, { color: 0x9aa0a8, size: 0.35, life: 0.55, rise: 0.7, opacity: 0.22 });
  }

  function fxUpdate(dt) {
    fxTime += dt;
    if (!fxReady) return;

    for (let i = 0; i < 240; i++) {
      if (sparkLife[i] > 0) {
        sparkLife[i] -= dt;
        if (sparkLife[i] <= 0) {
          sparkPos[i * 3 + 1] = -999;
        } else {
          sparkVel[i * 3 + 1] -= 9.8 * dt * 0.6;
          sparkPos[i * 3] += sparkVel[i * 3] * dt;
          sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
          sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
          if (sparkPos[i * 3 + 1] < 0.03) {
            sparkPos[i * 3 + 1] = 0.03;
            sparkVel[i * 3 + 1] *= -0.4;
          }
        }
      }
    }
    if (sparkPoints && sparkPoints.geometry) {
      sparkPoints.geometry.attributes.position.needsUpdate = true;
      sparkPoints.geometry.attributes.color.needsUpdate = true;
    }

    for (let i = 0; i < smokePool.length; i++) {
      const sp = smokePool[i];
      if (sp.life > 0) {
        sp.life -= dt;
        if (sp.life <= 0) {
          sp.s.visible = false;
        } else {
          const t = 1 - sp.life / sp.max;
          sp.s.position.y += sp.rise * dt;
          sp.s.scale.x += sp.grow * dt;
          sp.s.scale.y += sp.grow * dt;
          sp.s.material.opacity = sp.baseOp * (1 - t) * Math.min(1, t * 7);
        }
      }
    }

    for (let i = 0; i < all.length; i++) {
      const car = all[i];
      if (car.health < 60) {
        car._smkAcc = (car._smkAcc || 0) + dt * (car.health < 25 ? 11 : (car.health <= 0 ? 14 : 5));
        while (car._smkAcc > 1) {
          car._smkAcc -= 1;
          const fX = -Math.sin(car.heading);
          const fZ = -Math.cos(car.heading);
          const frontX = car.x + fX * 1.8;
          const frontZ = car.z + fZ * 1.8;
          fxSmoke(frontX, 1.0, frontZ, {
            color: car.health < 25 ? 0x23232a : 0x4a4a52,
            size: 0.9,
            life: 1.1,
            rise: 1.6,
            opacity: 0.4
          });
        }
      }
    }
  }

  function update(dt) {
    const colliders = VB.city && VB.city.colliders ? VB.city.colliders : [];

    for (let i = 0; i < all.length; i++) {
      const car = all[i];
      if (car.drivenByPlayer || car.aiDriven || car.parked) {
        // Player car, police car, or parked cars are handled elsewhere or static
        if (car.drivenByPlayer || car.aiDriven) {
          car.mesh.position.set(car.x, 0, car.z);
          car.mesh.rotation.y = car.heading;
          if (car.cones) {
            var lightsOn = car.drivenByPlayer || car.aiDriven || (car.avenue && car.speed > 0.5);
            for (var ci = 0; ci < car.cones.length; ci++) car.cones[ci].visible = !!lightsOn;
          }
        }
        continue;
      }

      // Traffic cars driving straight along avenue
      if (car.avenue) {
        // Accelerate toward targetSpeed
        if (car.speed < car.targetSpeed) {
          car.speed = Math.min(car.targetSpeed, car.speed + dt * 10);
        } else if (car.speed > car.targetSpeed) {
          car.speed = Math.max(car.targetSpeed, car.speed - dt * 10);
        }

        // Check for cars ahead within 9m on same avenue and lane
        const forwardX = -Math.sin(car.heading);
        const forwardZ = -Math.cos(car.heading);

        for (let j = 0; j < all.length; j++) {
          if (i === j) continue;
          const other = all[j];
          if (other.avenue === car.avenue && other.dir === car.dir) {
            const dx = other.x - car.x;
            const dz = other.z - car.z;
            const distAlong = dx * forwardX + dz * forwardZ;
            if (distAlong > 0 && distAlong < 9.0) {
              // Slow down to match other car speed, keep 5m gap
              car.speed = Math.min(car.speed, other.speed * 0.9);
            }
          }
        }

        // Move car
        car.x += forwardX * car.speed * dt;
        car.z += forwardZ * car.speed * dt;

        // Wrap around city edge (plus/minus 267m or 280m)
        const extent = 280;
        if (car.avenue.axis === 'z') {
          if (car.z > extent) car.z = -extent;
          if (car.z < -extent) car.z = extent;
        } else {
          if (car.x > extent) car.x = -extent;
          if (car.x < -extent) car.x = extent;
        }
      }

      // Soft collision with buildings (two circles: radius 1.05, centers ±1.25m along forward)
      const fX = -Math.sin(car.heading);
      const fZ = -Math.cos(car.heading);
      const rRadius = 1.05;
      const c1x = car.x + fX * 1.25;
      const c1z = car.z + fZ * 1.25;
      const c2x = car.x - fX * 1.25;
      const c2z = car.z - fZ * 1.25;

      for (const box of colliders) {
        // Test c1
        resolveCircleBoxCollision(car, c1x, c1z, rRadius, box, fX, fZ);
        // Test c2
        resolveCircleBoxCollision(car, c2x, c2z, rRadius, box, fX, fZ);
      }

      // Sync mesh
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;

      if (car.cones) {
        var lightsOn = car.drivenByPlayer || car.aiDriven || (car.avenue && car.speed > 0.5);
        for (var ci = 0; ci < car.cones.length; ci++) car.cones[ci].visible = !!lightsOn;
      }
    }

    fxUpdate(dt);
  }

  function resolveCircleBoxCollision(car, cx, cz, radius, box, fX, fZ) {
    const closestX = Math.max(box.minX, Math.min(cx, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(cz, box.maxZ));
    const distX = cx - closestX;
    const distZ = cz - closestZ;
    const distSq = distX * distX + distZ * distZ;

    if (distSq < radius * radius && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const overlap = radius - dist;
      const nx = distX / dist;
      const nz = distZ / dist;

      car.x += nx * overlap;
      car.z += nz * overlap;
      car.speed = 0;
    }
  }

  const fxApi = {
    sparks: fxSparks,
    smoke: fxSmoke,
    skid: fxSkid,
    exhaust: fxExhaust,
    update: fxUpdate
  };

  return {
    all,
    init,
    update,
    spawnScripted,
    remove,
    makeCarMesh,
    fx: fxApi,
    get heroCar() { return heroCar; },
    set heroCar(val) { heroCar = val; }
  };
})();

window.VB.fx = window.VB.cars.fx;
