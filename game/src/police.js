window.VB = window.VB || {};

window.VB.police = (function() {
  let stars = 0;
  let bustProgress = 0;
  let locked = false;
  let policeCars = [];
  let lastSeenAt = 0;
  let sirenActive = false;

  const lastCrimeTime = {
    steal: 0,
    hitPed: 0,
    gunshot: 0
  };

  let lastGunshotSound = 0;

  function createRandom(seed) {
    let s = seed | 0;
    return function() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = createRandom(20261118 + 777);

  function init(scene) {
    reset();
  }

  function reset() {
    stars = 0;
    bustProgress = 0;
    locked = false;
    lastSeenAt = 0;
    for (const car of [...policeCars]) {
      if (VB.cars && typeof VB.cars.remove === 'function') {
        VB.cars.remove(car);
      }
    }
    policeCars.length = 0;
    if (sirenActive && VB.audio && typeof VB.audio.sirenStop === 'function') {
      VB.audio.sirenStop();
    }
    sirenActive = false;
  }

  function lock() {
    locked = true;
  }

  function unlock() {
    locked = false;
  }

  function setStars(n) {
    stars = Math.max(0, Math.min(5, n));
    lastSeenAt = VB.world ? VB.world.time : 0;
    if (stars === 0) {
      for (const car of [...policeCars]) {
        if (VB.cars && typeof VB.cars.remove === 'function') {
          VB.cars.remove(car);
        }
      }
      policeCars.length = 0;
      if (sirenActive && VB.audio && typeof VB.audio.sirenStop === 'function') {
        VB.audio.sirenStop();
      }
      sirenActive = false;
    }
  }

  function addStars(n) {
    if (locked) return;
    setStars(stars + n);
  }

  function crime(kind) {
    if (locked || stars >= 5) return;
    const now = VB.world ? VB.world.time : 0;
    const cooldowns = { steal: 5, hitPed: 4, gunshot: 6 };
    const cd = cooldowns[kind] || 5;
    if (now - lastCrimeTime[kind] < cd) return;
    lastCrimeTime[kind] = now;
    addStars(1);
    lastSeenAt = now;
  }

  function update(dt) {
    const worldTime = VB.world ? VB.world.time : 0;
    const px = VB.player ? VB.player.x : 0;
    const pz = VB.player ? VB.player.z : 0;

    let inHideout = false;
    if (VB.landmarks && VB.landmarks.hideout) {
      const h = VB.landmarks.hideout;
      const dx = px - h.x;
      const dz = pz - h.z;
      if (dx * dx + dz * dz <= h.r * h.r) {
        inHideout = true;
      }
    }

    const wantedCount = stars > 0 ? Math.min(5, stars + 1) : 0;

    for (let i = policeCars.length - 1; i >= 0; i--) {
      const car = policeCars[i];
      const dx = car.x - px;
      const dz = car.z - pz;
      if (dx * dx + dz * dz > 240 * 240 || stars === 0 || inHideout) {
        if (VB.cars && typeof VB.cars.remove === 'function') {
          VB.cars.remove(car);
        }
        policeCars.splice(i, 1);
      }
    }

    if (stars > 0 && !inHideout && policeCars.length < wantedCount) {
      const missing = wantedCount - policeCars.length;
      for (let s = 0; s < missing; s++) {
        let spawnPos = null;
        let spawnHeading = 0;
        if (VB.city && VB.city.roadLines && VB.city.roadLines.length > 0) {
          for (let attempt = 0; attempt < 15; attempt++) {
            const road = VB.city.roadLines[Math.floor(rng() * VB.city.roadLines.length)];
            let rx = 0, rz = 0;
            if (road.axis === 'z') {
              rx = road.at;
              rz = (rng() - 0.5) * 400;
              spawnHeading = rng() > 0.5 ? 0 : Math.PI;
            } else {
              rz = road.at;
              rx = (rng() - 0.5) * 400;
              spawnHeading = rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
            }
            const dist = Math.sqrt((rx - px) * (rx - px) + (rz - pz) * (rz - pz));
            if (dist >= 90 && dist <= 140) {
              spawnPos = { x: rx, z: rz, heading: spawnHeading };
              break;
            }
          }
        }
        if (!spawnPos) {
          const angle = rng() * Math.PI * 2;
          const dist = 110;
          spawnPos = { x: px + Math.sin(angle) * dist, z: pz + Math.cos(angle) * dist, heading: rng() * Math.PI * 2 };
        }

        if (VB.cars && typeof VB.cars.spawnScripted === 'function') {
          const pCar = VB.cars.spawnScripted({
            kind: 'police',
            color: 0xf2f2f2,
            x: spawnPos.x,
            z: spawnPos.z,
            heading: spawnPos.heading
          });
          if (pCar) {
            pCar.isPolice = true;
            pCar.aiDriven = true;
            pCar.speed = 0;
            pCar.stuckTime = 0;
            policeCars.push(pCar);
          }
        }
      }
    }

    if (policeCars.length > 0) {
      if (!sirenActive) {
        sirenActive = true;
        if (VB.audio && typeof VB.audio.sirenStart === 'function') {
          VB.audio.sirenStart();
        }
      }
    } else {
      if (sirenActive) {
        sirenActive = false;
        if (VB.audio && typeof VB.audio.sirenStop === 'function') {
          VB.audio.sirenStop();
        }
      }
    }

    let anySeen = false;
    for (const car of policeCars) {
      const dx = car.x - px;
      const dz = car.z - pz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= 70 && !inHideout) {
        anySeen = true;
        break;
      }
    }

    if (anySeen && stars > 0 && !inHideout) {
      lastSeenAt = worldTime;
    }

    const sightLossSec = VB.config && VB.config.sightLossSeconds ? VB.config.sightLossSeconds : 12;
    if (!locked && stars > 0 && (worldTime - lastSeenAt > sightLossSec)) {
      setStars(stars - 1);
      lastSeenAt = worldTime;
    }

    let anyNearPlayerForBust = false;
    const colliders = VB.city && VB.city.colliders ? VB.city.colliders : [];

    for (let i = 0; i < policeCars.length; i++) {
      const car = policeCars[i];

      const targetDx = px - car.x;
      const targetDz = pz - car.z;
      const targetHeading = Math.atan2(-targetDx, -targetDz);

      let diff = targetHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = 1.7 * dt;
      if (diff > maxTurn) diff = maxTurn;
      if (diff < -maxTurn) diff = -maxTurn;
      car.heading += diff;

      const distToPlayer = Math.sqrt(targetDx * targetDx + targetDz * targetDz);
      const topSpd = distToPlayer > 120 ? 44 : 40;
      const accel = 16;

      if (distToPlayer < 8) {
        if (car.speed > 5) car.speed = Math.max(0, car.speed - accel * 2 * dt);
        else car.speed = Math.max(-5, car.speed - accel * dt);
      } else {
        if (car.speed < topSpd) {
          car.speed = Math.min(topSpd, car.speed + accel * dt);
        } else if (car.speed > topSpd) {
          car.speed = Math.max(topSpd, car.speed - accel * dt);
        }
      }

      const prevX = car.x;
      const prevZ = car.z;
      car.x -= Math.sin(car.heading) * car.speed * dt;
      car.z -= Math.cos(car.heading) * car.speed * dt;

      const fx = -Math.sin(car.heading);
      const fz = -Math.cos(car.heading);
      const radius = 1.05;
      const centers = [
        { x: car.x + fx * 1.25, z: car.z + fz * 1.25 },
        { x: car.x - fx * 1.25, z: car.z - fz * 1.25 }
      ];

      let pushX = 0;
      let pushZ = 0;
      let collided = false;

      for (const c of centers) {
        for (let b = 0; b < colliders.length; b++) {
          const box = colliders[b];
          const minX = box.minX !== undefined ? box.minX : (box.min ? box.min.x : 0);
          const maxX = box.maxX !== undefined ? box.maxX : (box.max ? box.max.x : 0);
          const minZ = box.minZ !== undefined ? box.minZ : (box.min ? box.min.z : 0);
          const maxZ = box.maxZ !== undefined ? box.maxZ : (box.max ? box.max.z : 0);

          const nx = Math.max(minX, Math.min(c.x, maxX));
          const nz = Math.max(minZ, Math.min(c.z, maxZ));

          const dx = c.x - nx;
          const dz = c.z - nz;
          const dsq = dx * dx + dz * dz;

          if (dsq < radius * radius && dsq > 0) {
            collided = true;
            const dist = Math.sqrt(dsq);
            const overlap = radius - dist;
            pushX += (dx / dist) * overlap;
            pushZ += (dz / dist) * overlap;
          }
        }
      }

      if (collided) {
        car.x += pushX * 0.5;
        car.z += pushZ * 0.5;
        car.speed *= 0.4;
      }

      const movedDist = Math.sqrt((car.x - prevX)**2 + (car.z - prevZ)**2);
      if (Math.abs(car.speed) > 2 && movedDist < 0.1 * dt * 60) {
        car.stuckTime = (car.stuckTime || 0) + dt;
        if (car.stuckTime >= 2.5) {
          if (VB.cars && typeof VB.cars.remove === 'function') {
            VB.cars.remove(car);
          }
          policeCars.splice(i, 1);
          i--;
          continue;
        }
      } else {
        car.stuckTime = 0;
      }

      if (VB.player) {
        const pCar = VB.player.car;
        if (VB.player.isDriving() && pCar) {
          const pdx = car.x - pCar.x;
          const pdz = car.z - pCar.z;
          const pdist = Math.sqrt(pdx * pdx + pdz * pdz);
          if (pdist < 3) {
            if (worldTime - (car.lastCrashTime || 0) >= 1.0) {
              car.lastCrashTime = worldTime;
              if (VB.audio && typeof VB.audio.crash === 'function') {
                VB.audio.crash();
              }
            }
            const pushFactor = 0.5;
            car.x += (pdx / (pdist || 1)) * pushFactor;
            car.z += (pdz / (pdist || 1)) * pushFactor;
            pCar.x -= (pdx / (pdist || 1)) * pushFactor;
            pCar.z -= (pdz / (pdist || 1)) * pushFactor;
          }
        }
      }

      if (car.mesh) {
        car.mesh.position.set(car.x, 0.2, car.z);
        car.mesh.rotation.y = car.heading;
      }

      if (car.lightBar && car.lightBar.children) {
        const flash = Math.sin(worldTime * Math.PI * 12) > 0 ? 2.5 : 0.2;
        for (const child of car.lightBar.children) {
          if (child.material) {
            child.material.emissiveIntensity = flash;
          }
        }
      }

      if (stars >= 3 && anySeen && distToPlayer <= 30) {
        car.shootTimer = (car.shootTimer || 0) + dt;
        if (car.shootTimer >= 1.4) {
          car.shootTimer = 0;
          if (rng() < 0.35 && VB.player && typeof VB.player.damage === 'function') {
            const policeDmg = VB.config && VB.config.policeBulletDamage ? VB.config.policeBulletDamage : 5;
            VB.player.damage(policeDmg);
          }
          if (worldTime - lastGunshotSound >= 1.0) {
            lastGunshotSound = worldTime;
            if (VB.audio && typeof VB.audio.gunshot === 'function') {
              VB.audio.gunshot();
            }
          }
        }
      }

      let playerSpeed = 0;
      if (VB.player.isDriving() && VB.player.car) {
        playerSpeed = Math.abs(VB.player.car.speed);
      } else {
        const moving = VB.input && VB.input.keys && (VB.input.keys['KeyW'] || VB.input.keys['KeyS'] || VB.input.keys['KeyA'] || VB.input.keys['KeyD'] || VB.input.keys['ArrowUp'] || VB.input.keys['ArrowDown'] || VB.input.keys['ArrowLeft'] || VB.input.keys['ArrowRight'] || VB.player.autopilot);
        playerSpeed = moving ? 2 : 0;
      }

      if (distToPlayer <= 7 && playerSpeed < 1) {
        anyNearPlayerForBust = true;
      }
    }

    const bustSec = VB.config && VB.config.bustSeconds ? VB.config.bustSeconds : 2.5;
    if (anySeen && anyNearPlayerForBust && stars > 0) {
      bustProgress += dt / bustSec;
      if (bustProgress >= 1) {
        bustProgress = 1;
        if (VB.world) {
          const fine = Math.round(VB.world.cash * 0.1);
          if (typeof VB.world.addCash === 'function') {
            VB.world.addCash(-fine);
          }
          if (typeof VB.world.setState === 'function') {
            VB.world.setState('busted');
          }
        }
        if (sirenActive && VB.audio && typeof VB.audio.sirenStop === 'function') {
          VB.audio.sirenStop();
        }
        sirenActive = false;
        if (VB.missions && typeof VB.missions.onWasted === 'function') {
          VB.missions.onWasted();
        }
      }
    } else {
      bustProgress = Math.max(0, bustProgress - dt * 2);
    }
  }

  return {
    get stars() { return stars; },
    get bustProgress() { return bustProgress; },
    init,
    update,
    crime,
    setStars,
    addStars,
    lock,
    unlock,
    reset
  };
})();
