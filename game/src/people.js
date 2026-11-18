window.VB = window.VB || {};

window.VB.people = (function() {
  let all = [];
  let fixer = null;
  let personIdCounter = 1;
  let lastShotTime = 0;
  let alarmAt = null; // { x, z, t }

  function createRandom(seed) {
    let s = seed | 0;
    return function() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = createRandom(20261118 + 202);

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

  function makePersonMesh(shirtHex, pantsHex, skinHex) {
    const group = new THREE.Group();

    // 1. Torso + head + arms merged into one geometry
    const torsoGeom = createColoredBox(0.42, 0.65, 0.25, shirtHex);
    torsoGeom.translate(0, 1.05, 0);

    const headGeom = createColoredBox(0.3, 0.32, 0.3, skinHex);
    headGeom.translate(0, 1.55, 0);

    const armLGeom = createColoredBox(0.15, 0.55, 0.2, shirtHex);
    armLGeom.translate(0.3, 1.05, 0);

    const armRGeom = createColoredBox(0.15, 0.55, 0.2, shirtHex);
    armRGeom.translate(-0.3, 1.05, 0);

    const upperBodyGeom = mergeGeometries([torsoGeom, headGeom, armLGeom, armRGeom]);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 });
    const upperBodyMesh = new THREE.Mesh(upperBodyGeom, material);
    upperBodyMesh.castShadow = true;
    group.add(upperBodyMesh);

    // 2. Left leg box (pivoted at hip)
    const legLGeom = createColoredBox(0.16, 0.7, 0.2, pantsHex);
    legLGeom.translate(0, -0.35, 0); // pivot at top of leg
    const legLMesh = new THREE.Mesh(legLGeom, material);
    legLMesh.position.set(-0.11, 0.7, 0);
    legLMesh.castShadow = true;
    group.add(legLMesh);

    // 3. Right leg box (pivoted at hip)
    const legRGeom = createColoredBox(0.16, 0.7, 0.2, pantsHex);
    legRGeom.translate(0, -0.35, 0);
    const legRMesh = new THREE.Mesh(legRGeom, material);
    legRMesh.position.set(0.11, 0.7, 0);
    legRMesh.castShadow = true;
    group.add(legRMesh);

    group.userData.leftLeg = legLMesh;
    group.userData.rightLeg = legRMesh;

    return group;
  }

  function init(scene) {
    all.length = 0;
    fixer = null;

    const shirtColors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0x34495e];
    const pantsColors = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x111111, 0x27ae60];
    const skinColors = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524];

    // 1. Spawn 24 pedestrians on random sidewalkLoops
    const sidewalkLoops = VB.city && VB.city.sidewalkLoops ? VB.city.sidewalkLoops : [];
    for (let i = 0; i < 24; i++) {
      if (sidewalkLoops.length === 0) break;
      const loop = sidewalkLoops[Math.floor(rng() * sidewalkLoops.length)];
      const wpIndex = Math.floor(rng() * loop.length);
      const startWp = loop[wpIndex];

      const shirt = shirtColors[Math.floor(rng() * shirtColors.length)];
      const pants = pantsColors[Math.floor(rng() * pantsColors.length)];
      const skin = skinColors[Math.floor(rng() * skinColors.length)];

      const mesh = makePersonMesh(shirt, pants, skin);
      mesh.position.set(startWp.x, 0.1, startWp.z);
      scene.add(mesh);

      const person = {
        id: personIdCounter++,
        mesh,
        x: startWp.x,
        z: startWp.z,
        heading: 0,
        speed: 1.2 + rng() * 0.6, // 1.2 - 1.8 m/s
        health: 10,
        role: 'ped',
        state: 'wander',
        loop,
        wpIndex,
        waitTime: 0,
        shootCd: 0,
        fleeTimer: 0,
        walkPhase: rng() * Math.PI * 2,
        isRival: false
      };
      all.push(person);
    }

    // 2. Spawn the fixer: distinctive person (magenta shirt) standing idle at fixerSpot landmark
    const fixerSpot = { x: 44, z: -46 };
    if (VB.landmarks && VB.landmarks.fixerSpot) {
      fixerSpot.x = VB.landmarks.fixerSpot.x;
      fixerSpot.z = VB.landmarks.fixerSpot.z;
    }

    const fixerMesh = makePersonMesh(0xff4fa3, 0x111111, 0xffdbac);
    fixerMesh.position.set(fixerSpot.x, 0.1, fixerSpot.z);
    scene.add(fixerMesh);

    fixer = {
      id: personIdCounter++,
      mesh: fixerMesh,
      x: fixerSpot.x,
      z: fixerSpot.z,
      heading: 0,
      speed: 0,
      health: 100,
      role: 'fixer',
      state: 'idle',
      loop: null,
      wpIndex: 0,
      waitTime: 0,
      shootCd: 0,
      fleeTimer: 0,
      walkPhase: 0,
      isRival: false
    };
    all.push(fixer);
  }

  function spawnRival(x, z) {
    const shirt = 0x882222; // dark red shirt
    const pants = 0x111111;
    const skin = 0xf1c27d;
    const rivalHealth = VB.config && VB.config.rivalHealth ? VB.config.rivalHealth : 68;

    const mesh = makePersonMesh(shirt, pants, skin);
    mesh.position.set(x, 0.1, z);
    if (VB.world && VB.world.scene) {
      VB.world.scene.add(mesh);
    }

    const rival = {
      id: personIdCounter++,
      mesh,
      x,
      z,
      heading: 0,
      speed: 1.5,
      health: rivalHealth,
      role: 'rival',
      state: 'wander',
      loop: null,
      wpIndex: 0,
      waitTime: 0,
      shootCd: 1.0 + rng() * 2.0,
      fleeTimer: 0,
      walkPhase: rng() * Math.PI * 2,
      isRival: true
    };
    all.push(rival);
    return rival;
  }

  function clearRivals() {
    for (let i = all.length - 1; i >= 0; i--) {
      const p = all[i];
      if (p.role === 'rival') {
        if (p.mesh && p.mesh.parent) {
          p.mesh.parent.remove(p.mesh);
        }
        all.splice(i, 1);
      }
    }
  }

  function rivalsAlive() {
    let count = 0;
    for (const p of all) {
      if (p.role === 'rival' && p.state !== 'down' && p.health > 0) {
        count++;
      }
    }
    return count;
  }

  function update(dt) {
    const time = VB.world ? VB.world.time : 0;
    const cars = VB.cars && VB.cars.all ? VB.cars.all : [];

    for (let i = all.length - 1; i >= 0; i--) {
      const p = all[i];

      // If down, handle timer and removal after 10s
      if (p.state === 'down') {
        p.downTimer = (p.downTimer || 0) + dt;
        if (p.downTimer > 10.0) {
          if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
          all.splice(i, 1);
          if (p === fixer) fixer = null;
        }
        continue;
      }

      // Check hit by fast moving car (> 6 m/s) or health <= 0
      if (p.health <= 0) {
        makePersonDown(p);
        continue;
      }

      for (const car of cars) {
        if (car.speed && Math.abs(car.speed) > 6.0) {
          const dx = car.x - p.x;
          const dz = car.z - p.z;
          const distSq = dx * dx + dz * dz;
          if (distSq < 2.0 * 2.0) {
            p.health = 0;
            makePersonDown(p);
            break;
          }
        }
      }
      if (p.state === 'down') continue;

      // Fixer or idle role does not wander
      if (p.role === 'fixer' || p.state === 'idle') {
        p.mesh.position.set(p.x, 0.1, p.z);
        continue;
      }

      // Rivals handled in updateRivals
      if (p.role === 'rival') {
        continue;
      }

      // Threat check: fast car within 6m ahead OR gunshot alarmAt within 25m and fresh (< 3s)
      let isThreatened = false;
      let threatX = 0, threatZ = 0;

      for (const car of cars) {
        if (car.speed && Math.abs(car.speed) > 4.0) {
          const dx = car.x - p.x;
          const dz = car.z - p.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 6.0) {
            isThreatened = true;
            threatX = car.x;
            threatZ = car.z;
          }
        }
      }

      if (alarmAt && (time - alarmAt.t < 3.0)) {
        const dx = alarmAt.x - p.x;
        const dz = alarmAt.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 25.0) {
          isThreatened = true;
          threatX = alarmAt.x;
          threatZ = alarmAt.z;
        }
      }

      if (isThreatened && p.state !== 'flee') {
        p.state = 'flee';
        p.fleeTimer = 3.0;
      }

      if (p.state === 'flee') {
        p.fleeTimer -= dt;
        if (p.fleeTimer <= 0) {
          p.state = 'wander';
        } else {
          // Flee directly away from threat
          const angle = Math.atan2(p.x - threatX, p.z - threatZ);
          p.heading = angle;
          const fSpeed = 4.5;
          p.x += Math.sin(p.heading) * fSpeed * dt;
          p.z += Math.cos(p.heading) * fSpeed * dt;

          p.walkPhase += dt * 10;
          updateLegs(p, true);
          p.mesh.position.set(p.x, 0.1, p.z);
          p.mesh.rotation.y = p.heading;
          continue;
        }
      }

      // Wander along sidewalkLoop
      if (p.loop && p.loop.length > 0) {
        const targetWp = p.loop[p.wpIndex];
        const dx = targetWp.x - p.x;
        const dz = targetWp.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 1.0) {
          p.wpIndex = (p.wpIndex + 1) % p.loop.length;
        } else {
          p.heading = Math.atan2(dx, dz);
          p.x += Math.sin(p.heading) * p.speed * dt;
          p.z += Math.cos(p.heading) * p.speed * dt;

          p.walkPhase += dt * p.speed * 3.5;
          updateLegs(p, true);
        }
      }

      p.mesh.position.set(p.x, 0.1, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }

  function makePersonDown(p) {
    p.state = 'down';
    p.downTimer = 0;
    p.mesh.rotation.x = -Math.PI / 2;
    p.mesh.position.y = 0.15;
  }

  function updateLegs(p, walking) {
    if (!p.mesh.userData.leftLeg || !p.mesh.userData.rightLeg) return;
    if (walking) {
      p.mesh.userData.leftLeg.rotation.x = Math.sin(p.walkPhase) * 0.6;
      p.mesh.userData.rightLeg.rotation.x = -Math.sin(p.walkPhase) * 0.6;
    } else {
      p.mesh.userData.leftLeg.rotation.x = 0;
      p.mesh.userData.rightLeg.rotation.x = 0;
    }
  }

  function updateRivals(dt, targetPos) {
    if (!targetPos) return;
    const time = VB.world ? VB.world.time : 0;
    let firedCountThisSecond = 0;

    for (const p of all) {
      if (p.role !== 'rival' || p.state === 'down' || p.health <= 0) continue;

      const dx = targetPos.x - p.x;
      const dz = targetPos.z - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Face target
      p.heading = Math.atan2(dx, dz);
      p.mesh.rotation.y = p.heading;

      // Keep 8-20m from target, strafe slowly
      if (dist > 20.0) {
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
      } else if (dist < 8.0) {
        p.x -= Math.sin(p.heading) * p.speed * dt;
        p.z -= Math.cos(p.heading) * p.speed * dt;
      } else {
        // Strafe sideways
        const strafeDir = (p.id % 2 === 0) ? 1 : -1;
        p.x += Math.cos(p.heading) * p.speed * 0.5 * dt * strafeDir;
        p.z -= Math.sin(p.heading) * p.speed * 0.5 * dt * strafeDir;
      }
      p.mesh.position.set(p.x, 0.1, p.z);

      // Shooting cadence
      p.shootCd -= dt;
      if (p.shootCd <= 0) {
        p.shootCd = 1.5 + rng() * 2.0;
        if (dist <= 35.0 && firedCountThisSecond < 2) {
          if (rng() < 0.4) {
            firedCountThisSecond++;
            if (VB.player && typeof VB.player.damage === 'function') {
              VB.player.damage(6);
            }
            if (VB.audio && typeof VB.audio.gunshot === 'function' && (time - lastShotTime >= 1.0)) {
              VB.audio.gunshot();
              lastShotTime = time;
            }
          }
        }
      }
    }
  }

  // Allow setting gunshot alarm
  function triggerAlarm(x, z) {
    alarmAt = { x, z, t: VB.world ? VB.world.time : 0 };
  }

  return {
    all,
    init,
    update,
    spawnRival,
    clearRivals,
    rivalsAlive,
    updateRivals,
    makePersonMesh,
    triggerAlarm,
    get fixer() { return fixer; },
    set fixer(val) { fixer = val; }
  };
})();
