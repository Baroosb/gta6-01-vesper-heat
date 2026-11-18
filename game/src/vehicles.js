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

    if (kind === 'sedan' || kind === 'police') {
      // Main body
      const body = createColoredBox(1.8, 0.6, 4.2, bodyColor);
      body.translate(0, 0.5, 0);
      geos.push(body);

      // Cabin mid
      const cabin = createColoredBox(1.6, 0.5, 2.0, glassColor);
      cabin.translate(0, 1.05, -0.1);
      geos.push(cabin);

      // Doors trim for police
      if (isPolice) {
        const doorL = createColoredBox(0.05, 0.55, 1.8, trimColor);
        doorL.translate(0.91, 0.5, 0);
        geos.push(doorL);
        const doorR = createColoredBox(0.05, 0.55, 1.8, trimColor);
        doorR.translate(-0.91, 0.5, 0);
        geos.push(doorR);
      }

      // Bumpers & lights
      const bFront = createColoredBox(1.7, 0.2, 0.2, trimColor);
      bFront.translate(0, 0.35, -2.1);
      geos.push(bFront);
      const bRear = createColoredBox(1.7, 0.2, 0.2, trimColor);
      bRear.translate(0, 0.35, 2.1);
      geos.push(bRear);

      const hLightL = createColoredBox(0.3, 0.1, 0.05, headlightColor);
      hLightL.translate(0.6, 0.4, -2.12);
      geos.push(hLightL);
      const hLightR = createColoredBox(0.3, 0.1, 0.05, headlightColor);
      hLightR.translate(-0.6, 0.4, -2.12);
      geos.push(hLightR);

      const tLightL = createColoredBox(0.3, 0.1, 0.05, taillightColor);
      tLightL.translate(0.6, 0.4, 2.12);
      geos.push(tLightL);
      const tLightR = createColoredBox(0.3, 0.1, 0.05, taillightColor);
      tLightR.translate(-0.6, 0.4, 2.12);
      geos.push(tLightR);

    } else if (kind === 'coupe') {
      // Lower, longer hood
      const body = createColoredBox(1.8, 0.5, 4.2, bodyColor);
      body.translate(0, 0.45, 0);
      geos.push(body);

      const cabin = createColoredBox(1.5, 0.45, 1.6, glassColor);
      cabin.translate(0, 0.92, 0.2);
      geos.push(cabin);

      const bFront = createColoredBox(1.7, 0.18, 0.2, trimColor);
      bFront.translate(0, 0.33, -2.1);
      geos.push(bFront);
      const bRear = createColoredBox(1.7, 0.18, 0.2, trimColor);
      bRear.translate(0, 0.33, 2.1);
      geos.push(bRear);

    } else if (kind === 'van') {
      // Tall box, cabin front
      const body = createColoredBox(2.0, 1.6, 5.0, bodyColor);
      body.translate(0, 1.0, 0);
      geos.push(body);

      const windshield = createColoredBox(1.9, 0.6, 0.8, glassColor);
      windshield.translate(0, 1.3, -2.1);
      geos.push(windshield);

      const bFront = createColoredBox(1.9, 0.2, 0.2, trimColor);
      bFront.translate(0, 0.3, -2.5);
      geos.push(bFront);

    } else if (kind === 'pickup') {
      // Open bed rear
      const cab = createColoredBox(1.8, 1.1, 2.2, bodyColor);
      cab.translate(0, 0.75, -0.8);
      geos.push(cab);

      const bed = createColoredBox(1.8, 0.6, 2.4, bodyColor);
      bed.translate(0, 0.5, 1.2);
      geos.push(bed);

      const tailgate = createColoredBox(1.7, 0.3, 0.1, trimColor);
      tailgate.translate(0, 0.5, 2.4);
      geos.push(tailgate);
    }

    // Wheels (4 short wide cylinders)
    const wheelPositions = [
      { x: 0.95, z: 1.3 }, { x: -0.95, z: 1.3 },
      { x: 0.95, z: -1.3 }, { x: -0.95, z: -1.3 }
    ];
    for (const wp of wheelPositions) {
      const wheel = createColoredCylinder(0.35, 0.35, 0.3, 8, wheelColor);
      wheel.rotateZ(Math.PI / 2);
      wheel.translate(wp.x, 0.35, wp.z);
      geos.push(wheel);
    }

    const mergedGeom = mergeGeometries(geos);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 });
    const mesh = new THREE.Mesh(mergedGeom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

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

    const civilianColors = [0x224488, 0x882222, 0x338833, 0x887722, 0x555555, 0x8844aa, 0xcc8833, 0x228888];

    // 1. Spawn 18 traffic cars
    const roadLines = VB.city && VB.city.roadLines ? VB.city.roadLines : [];
    const kinds = ['sedan', 'coupe', 'van', 'pickup'];

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
        lightBar: mesh.userData.lightBar || null
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
        lightBar: mesh.userData.lightBar || null
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
      lightBar: heroMesh.userData.lightBar || null
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
      lightBar: mesh.userData.lightBar || null
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

  function update(dt) {
    const colliders = VB.city && VB.city.colliders ? VB.city.colliders : [];

    for (let i = 0; i < all.length; i++) {
      const car = all[i];
      if (car.drivenByPlayer || car.aiDriven || car.parked) {
        // Player car, police car, or parked cars are handled elsewhere or static
        if (car.drivenByPlayer || car.aiDriven) {
          car.mesh.position.set(car.x, 0, car.z);
          car.mesh.rotation.y = car.heading;
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
    }
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

  return {
    all,
    init,
    update,
    spawnScripted,
    remove,
    makeCarMesh,
    get heroCar() { return heroCar; },
    set heroCar(val) { heroCar = val; }
  };
})();
