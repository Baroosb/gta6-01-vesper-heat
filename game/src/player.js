window.VB = window.VB || {};

window.VB.player = (function() {
  let mode = 'foot'; // 'foot' | 'car'
  let car = null;
  let health = 100;
  let mesh = null;
  let x = 40;
  let z = -38;
  let y = 0;
  let heading = 0;
  let autopilot = null; // { throttle, steer }
  let fireCd = 0;
  let dead = false;

  let camYaw = 0;
  let camPitch = 0.2;
  let timeSinceDamage = 10;
  let walkAnimTime = 0;
  let camFov = 58;
  let skidTimer = 0;

  // Muzzle flash / tracer visual elements
  let muzzleFlashMesh = null;
  let activeTracers = [];

  function init(scene) {
    const saved = VB.save && VB.save.load ? VB.save.load() : null;
    if (saved && saved.playerPos) {
      x = saved.playerPos.x !== undefined ? saved.playerPos.x : 40;
      z = saved.playerPos.z !== undefined ? saved.playerPos.z : -38;
      heading = saved.playerPos.heading !== undefined ? saved.playerPos.heading : 0;
    } else if (VB.landmarks && VB.landmarks.heroStart) {
      x = VB.landmarks.heroStart.x;
      z = VB.landmarks.heroStart.z;
    }

    health = VB.config && VB.config.playerHealth ? VB.config.playerHealth : 100;
    mode = 'foot';
    car = null;
    autopilot = null;
    fireCd = 0;
    dead = false;
    camYaw = heading;

    // Create person mesh with teal shirt
    if (VB.people && typeof VB.people.makePersonMesh === 'function') {
      mesh = VB.people.makePersonMesh(0x20b2aa, 0x2c3e50, 0xffdbac);
    } else {
      mesh = new THREE.Group();
    }
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);

    // Create tiny emissive plane at gun for muzzle flash (hidden by default)
    const flashGeom = new THREE.PlaneGeometry(0.12, 0.12);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffaa, side: THREE.DoubleSide });
    muzzleFlashMesh = new THREE.Mesh(flashGeom, flashMat);
    muzzleFlashMesh.visible = false;
    mesh.add(muzzleFlashMesh);
    muzzleFlashMesh.position.set(0.3, 1.1, -0.4);
  }

  function respawn(atLandmarkName) {
    const landmark = VB.landmarks && VB.landmarks[atLandmarkName] ? VB.landmarks[atLandmarkName] : (VB.landmarks ? VB.landmarks.heroStart : { x: 40, z: -38 });
    x = landmark.x;
    z = landmark.z;
    heading = 0;
    camYaw = 0;
    camPitch = 0.2;
    health = VB.config && VB.config.playerHealth ? VB.config.playerHealth : 100;
    mode = 'foot';
    if (car) {
      car.drivenByPlayer = false;
      car = null;
    }
    autopilot = null;
    fireCd = 0;
    dead = false;
    if (mesh) {
      mesh.visible = true;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
    }
    if (VB.world && typeof VB.world.setState === 'function') {
      VB.world.setState('playing');
    }
  }

  function damage(n) {
    if (dead) return;
    health -= n;
    timeSinceDamage = 0;
    if (VB.audio && typeof VB.audio.hit === 'function') {
      VB.audio.hit();
    }
    if (health <= 0) {
      health = 0;
      dead = true;
      if (VB.audio && typeof VB.audio.engineStop === 'function') {
        VB.audio.engineStop();
      }
      if (VB.world && typeof VB.world.setState === 'function') {
        VB.world.setState('wasted');
      }
      if (VB.missions && typeof VB.missions.onWasted === 'function') {
        VB.missions.onWasted();
      }
    }
  }

  function heal(n) {
    const maxHp = VB.config && VB.config.playerHealth ? VB.config.playerHealth : 100;
    health = Math.min(maxHp, health + n);
  }

  function checkFootCollision(px, pz) {
    if (!VB.city || !VB.city.colliders) return { x: px, z: pz };
    let cx = px, cz = pz;
    const radius = 0.4;
    for (let i = 0; i < VB.city.colliders.length; i++) {
      const box = VB.city.colliders[i];
      const minX = box.minX !== undefined ? box.minX : (box.min ? box.min.x : 0);
      const maxX = box.maxX !== undefined ? box.maxX : (box.max ? box.max.x : 0);
      const minZ = box.minZ !== undefined ? box.minZ : (box.min ? box.min.z : 0);
      const maxZ = box.maxZ !== undefined ? box.maxZ : (box.max ? box.max.z : 0);

      const nearestX = Math.max(minX, Math.min(cx, maxX));
      const nearestZ = Math.max(minZ, Math.min(cz, maxZ));

      const dx = cx - nearestX;
      const dz = cz - nearestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const overlap = radius - dist;
        cx += (dx / dist) * overlap;
        cz += (dz / dist) * overlap;
      } else if (distSq === 0) {
        cx = minX - radius;
      }
    }
    if (cz > 339) cz = 339;
    return { x: cx, z: cz };
  }

  function checkCarCollision(carRec) {
    if (!VB.city || !VB.city.colliders) return;
    const fx = -Math.sin(carRec.heading);
    const fz = -Math.cos(carRec.heading);
    const radius = 1.05;

    // Two circles at +/- 1.25m along forward
    const centers = [
      { x: carRec.x + fx * 1.25, z: carRec.z + fz * 1.25 },
      { x: carRec.x - fx * 1.25, z: carRec.z - fz * 1.25 }
    ];

    let collided = false;
    let pushX = 0;
    let pushZ = 0;

    for (const c of centers) {
      for (let i = 0; i < VB.city.colliders.length; i++) {
        const box = VB.city.colliders[i];
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
      const prevSpeed = carRec.speed;
      carRec.x += pushX * 0.5;
      carRec.z += pushZ * 0.5;
      carRec.speed *= 0.5;
      const speedLoss = Math.abs(prevSpeed - carRec.speed);
      if (speedLoss > 6) {
        if (VB.audio && typeof VB.audio.crash === 'function') {
          VB.audio.crash(speedLoss / 20);
        }
        if (VB.fx && VB.fx.sparks) {
          VB.fx.sparks(centers[0].x, 0.5, centers[0].z, 14);
        }
        carRec.health = Math.max(0, (carRec.health || 100) - Math.floor(speedLoss * 2));
      }
    }
  }

  function update(dt) {
    if (!VB.world || (VB.world.state !== 'playing' && VB.world.state !== 'shot')) return;

    // Health regeneration
    if (health > 0 && health < (VB.config && VB.config.playerHealth ? VB.config.playerHealth : 100)) {
      timeSinceDamage += dt;
      if (timeSinceDamage >= 5) {
        health = Math.min(VB.config.playerHealth, health + 2 * dt);
      }
    }

    // Handle mouse look for camera / facing
    if (VB.input && typeof VB.input.takeLook === 'function') {
      const look = VB.input.takeLook();
      camYaw -= look.dx * 0.0026;
      camPitch = Math.max(-0.05, Math.min(0.55, camPitch + look.dy * 0.0026));
    }

    // Radio toggle (KeyM)
    if (VB.input && typeof VB.input.pressed === 'function' && VB.input.pressed('KeyM') && VB.audio && VB.audio.radioToggle) {
      const radioNowOn = VB.audio.radioToggle();
      if (VB.hud && VB.hud.toast) {
        VB.hud.toast(radioNowOn ? 'Radio: Vesper Waves ON' : 'Radio OFF');
      }
    }

    // F key interaction: enter/exit car
    if (VB.input && typeof VB.input.pressed === 'function' && VB.input.pressed('KeyF')) {
      if (mode === 'foot') {
        // Find nearest car within 3.2m
        if (VB.cars && VB.cars.all && Array.isArray(VB.cars.all)) {
          let nearestCar = null;
          let nearestDist = 3.2;
          for (let i = 0; i < VB.cars.all.length; i++) {
            const c = VB.cars.all[i];
            const dx = c.x - x;
            const dz = c.z - z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestCar = c;
            }
          }
          if (nearestCar) {
            car = nearestCar;
            car.drivenByPlayer = true;
            car.isPlayer = true;
            mode = 'car';
            if (mesh) mesh.visible = false;
            if (VB.audio && typeof VB.audio.door === 'function') VB.audio.door();
            if (VB.audio && typeof VB.audio.engineStart === 'function') VB.audio.engineStart();

            // Check crime (steal if not hero's own car and not already stolen)
            if (car !== VB.cars.heroCar && !car._stolenReported) {
              car._stolenReported = true;
              if (VB.police && typeof VB.police.crime === 'function') {
                VB.police.crime('steal');
              }
            }
          }
        }
      } else if (mode === 'car' && car) {
        // Exit car to the left
        const exitOffset = 2.2;
        const leftX = car.x - Math.cos(car.heading) * exitOffset;
        const leftZ = car.z + Math.sin(car.heading) * exitOffset;
        const safePos = checkFootCollision(leftX, leftZ);
        x = safePos.x;
        z = safePos.z;
        if (mesh) {
          mesh.position.set(x, 0, z);
          mesh.rotation.y = car.heading;
          mesh.visible = true;
        }
        car.drivenByPlayer = false;
        car = null;
        mode = 'foot';
        if (VB.audio && typeof VB.audio.door === 'function') VB.audio.door();
        if (VB.audio && typeof VB.audio.engineStop === 'function') VB.audio.engineStop();
      }
    }

    if (mode === 'foot') {
      // On foot movement
      heading = camYaw;
      let moveForward = 0;
      let moveRight = 0;

      if (autopilot) {
        moveForward = autopilot.throttle || 0;
        moveRight = autopilot.steer || 0;
      } else if (VB.input && VB.input.keys) {
        const keys = VB.input.keys;
        if (keys['KeyW'] || keys['ArrowUp']) moveForward += 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveForward -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveRight += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveRight -= 1;
      }

      const isRunning = VB.input && VB.input.keys && (VB.input.keys['ShiftLeft'] || VB.input.keys['ShiftRight']);
      const speed = isRunning ? (VB.config.runSpeed || 7.5) : (VB.config.walkSpeed || 3.2);

      if (moveForward !== 0 || moveRight !== 0) {
        const fX = -Math.sin(camYaw);
        const fZ = -Math.cos(camYaw);
        const rX = Math.cos(camYaw);
        const rZ = -Math.sin(camYaw);

        let vx = (fX * moveForward + rX * moveRight);
        let vz = (fZ * moveForward + rZ * moveRight);
        const len = Math.sqrt(vx * vx + vz * vz);
        if (len > 0) {
          vx = (vx / len) * speed * dt;
          vz = (vz / len) * speed * dt;
          x += vx;
          z += vz;

          const newPos = checkFootCollision(x, z);
          x = newPos.x;
          z = newPos.z;

          walkAnimTime += dt * (isRunning ? 14 : 9);
          if (mesh && mesh.userData.leftLeg && mesh.userData.rightLeg) {
            mesh.userData.leftLeg.rotation.x = Math.sin(walkAnimTime) * 0.5;
            mesh.userData.rightLeg.rotation.x = -Math.sin(walkAnimTime) * 0.5;
          }
          if (VB.audio && typeof VB.audio.step === 'function' && Math.sin(walkAnimTime) > 0.95) {
            VB.audio.step();
          }
        }
      } else {
        if (mesh && mesh.userData.leftLeg && mesh.userData.rightLeg) {
          mesh.userData.leftLeg.rotation.x = 0;
          mesh.userData.rightLeg.rotation.x = 0;
        }
      }

      if (mesh) {
        mesh.position.set(x, 0, z);
        mesh.rotation.y = heading;
      }

      // Combat (on foot firing)
      if (fireCd > 0) fireCd -= dt;
      const isFiring = (autopilot && autopilot.firing) || (VB.input && VB.input.firing);
      if (isFiring && fireCd <= 0 && health > 0) {
        fireCd = 0.12;
        if (VB.audio && typeof VB.audio.gunshot === 'function') {
          VB.audio.gunshot();
        }
        if (VB.people && typeof VB.people.triggerAlarm === 'function') {
          VB.people.triggerAlarm(x, z);
        }
        if (VB.police && typeof VB.police.crime === 'function') {
          VB.police.crime('gunshot');
        }

        // Raycast from camera/eye
        const pitch = camPitch;
        const yaw = camYaw;
        const dir = new THREE.Vector3(
          -Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          -Math.cos(yaw) * Math.cos(pitch)
        );
        const origin = new THREE.Vector3(x, 1.55, z);

        if (VB.raycast) {
          const hit = VB.raycast(origin, dir);
          if (hit.type === 'person' && hit.ref) {
            const dmg = VB.config && VB.config.gunDamage ? VB.config.gunDamage : 34;
            hit.ref.health = (hit.ref.health || 68) - dmg;
          } else if (hit.type === 'car' && hit.ref) {
            const dmg = VB.config && VB.config.gunDamage ? VB.config.gunDamage : 34;
            hit.ref.health = Math.max(0, (hit.ref.health || 100) - dmg);
          }

          // Spawn tracer line / box
          const hitPoint = hit.point || origin.clone().add(dir.clone().multiplyScalar(80));
          const scene = VB.world.scene;
          if (scene) {
            const tracerGeom = new THREE.BoxGeometry(0.04, 0.04, hit.dist < Infinity ? hit.dist : 40);
            const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffff88 });
            const tracer = new THREE.Mesh(tracerGeom, tracerMat);
            tracer.position.copy(origin).add(hitPoint).multiplyScalar(0.5);
            tracer.lookAt(hitPoint);
            scene.add(tracer);
            activeTracers.push({ mesh: tracer, t: 0.06 });
          }
        }

        // Muzzle flash show
        if (muzzleFlashMesh) {
          muzzleFlashMesh.visible = true;
          setTimeout(() => {
            if (muzzleFlashMesh) muzzleFlashMesh.visible = false;
          }, 40);
        }
      }

    } else if (mode === 'car' && car) {
      // Driving physics
      let throttle = 0;
      let steer = 0;
      let handbrake = false;

      if (autopilot) {
        throttle = autopilot.throttle || 0;
        steer = autopilot.steer || 0;
      } else if (VB.input && VB.input.keys) {
        const keys = VB.input.keys;
        if (keys['KeyW'] || keys['ArrowUp']) throttle += 1;
        if (keys['KeyS'] || keys['ArrowDown']) throttle -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) steer -= 1; // turning
        if (keys['KeyA'] || keys['ArrowLeft']) steer += 1;
        if (keys['Space']) handbrake = true;
      }
      if (VB.input && typeof VB.input.pressed === 'function' && VB.input.pressed('KeyH') && VB.audio && VB.audio.horn) {
        VB.audio.horn();
      }

      const topSpeed = VB.config && VB.config.carTopSpeed ? VB.config.carTopSpeed : 38;
      const revSpeed = VB.config && VB.config.carReverseSpeed ? VB.config.carReverseSpeed : 10;
      const accel = 14;

      if (throttle > 0) {
        car.speed = Math.min(topSpeed, car.speed + accel * dt);
      } else if (throttle < 0) {
        car.speed = Math.max(-revSpeed, car.speed - accel * dt);
      } else {
        car.speed *= handbrake ? 0.82 : 0.96;
      }

      skidTimer -= dt;
      var wantSkid = (handbrake && Math.abs(car.speed) > 7) || (Math.abs(steer) > 0.01 && Math.abs(car.speed) > 25);
      if (wantSkid && skidTimer <= 0 && VB.fx && VB.fx.skid) {
        skidTimer = 0.09;
        var fx = -Math.sin(car.heading);
        var fz = -Math.cos(car.heading);
        var rx = Math.cos(car.heading);
        var rz = -Math.sin(car.heading);
        var cx = car.x - fx * 1.3;
        var cz = car.z - fz * 1.3;
        var w1x = cx + rx * 0.95;
        var w1z = cz + rz * 0.95;
        var w2x = cx - rx * 0.95;
        var w2z = cz - rz * 0.95;
        VB.fx.skid(w1x, w1z, car.heading, Math.abs(car.speed) * 0.09 + 0.3);
        VB.fx.skid(w2x, w2z, car.heading, Math.abs(car.speed) * 0.09 + 0.3);
      }

      if (throttle > 0 && VB.fx && VB.fx.exhaust) {
        VB.fx.exhaust(car);
      }

      if (steer !== 0 && Math.abs(car.speed) > 0.5) {
        const speedRatio = Math.min(Math.abs(car.speed) / topSpeed, 1);
        const maxSteerAngle = 0.55 * (1 - 0.4 * speedRatio);
        car.heading += steer * maxSteerAngle * (car.speed / topSpeed) * dt * 2.2;
      }

      car.x -= Math.sin(car.heading) * car.speed * dt;
      car.z -= Math.cos(car.heading) * car.speed * dt;

      checkCarCollision(car);

      // Check pedestrian hit while driving
      if (Math.abs(car.speed) > 4 && VB.people && VB.people.all) {
        const fx = -Math.sin(car.heading);
        const fz = -Math.cos(car.heading);
        const pCenters = [
          { x: car.x + fx * 1.25, z: car.z + fz * 1.25 },
          { x: car.x - fx * 1.25, z: car.z - fz * 1.25 }
        ];
        for (let i = 0; i < VB.people.all.length; i++) {
          const p = VB.people.all[i];
          if (p.health > 0) {
            for (const pc of pCenters) {
              const pdx = p.x - pc.x;
              const pdz = p.z - pc.z;
              if (pdx * pdx + pdz * pdz <= 1.3 * 1.3) {
                p.health = 0;
                if (VB.police && typeof VB.police.crime === 'function') {
                  VB.police.crime('hitPed');
                }
                break;
              }
            }
          }
        }
      }

      if (car.mesh) {
        car.mesh.position.set(car.x, 0.2, car.z);
        car.mesh.rotation.y = car.heading;
      }

      x = car.x;
      z = car.z;
      heading = car.heading;

      if (VB.audio && typeof VB.audio.engineSet === 'function') {
        VB.audio.engineSet(Math.min(Math.abs(car.speed) / topSpeed, 1));
      }
    }

    // Update active tracers
    if (activeTracers.length > 0 && VB.world && VB.world.scene) {
      const scene = VB.world.scene;
      for (let i = activeTracers.length - 1; i >= 0; i--) {
        const tr = activeTracers[i];
        tr.t -= dt;
        if (tr.t <= 0) {
          scene.remove(tr.mesh);
          activeTracers.splice(i, 1);
        }
      }
    }

    // Follow shadow
    if (VB.scenery && typeof VB.scenery.followShadow === 'function') {
      VB.scenery.followShadow(x, z);
    }

    // Camera update (unless shotMode is active and owns camera)
    if (VB.world && !VB.world.shotMode && VB.world.camera) {
      const camera = VB.world.camera;
      const targetFov = (mode === 'car' && car) ? (58 + 11 * Math.pow(Math.min(1, Math.abs(car.speed) / (VB.config && VB.config.carTopSpeed ? VB.config.carTopSpeed : 38)), 2)) : 58;
      camFov += (targetFov - camFov) * Math.min(1, dt * 5);
      if (Math.abs(camera.fov - camFov) > 0.01) {
        camera.fov = camFov;
        camera.updateProjectionMatrix();
      }

      if (mode === 'foot') {
        const dist = 6.5;
        const targetCamX = x + Math.sin(camYaw) * dist * Math.cos(camPitch);
        const targetCamZ = z + Math.cos(camYaw) * dist * Math.cos(camPitch);
        const targetCamY = (y + 1.2) + Math.sin(camPitch) * dist;
        camera.position.set(targetCamX, targetCamY, targetCamZ);
        camera.lookAt(x, y + 1.35, z);
      } else if (mode === 'car' && car) {
        const idealCamX = car.x + Math.sin(car.heading) * 8.5;
        const idealCamZ = car.z + Math.cos(car.heading) * 8.5;
        const idealCamY = 3.2;
        camera.position.x += (idealCamX - camera.position.x) * 0.1;
        camera.position.y += (idealCamY - camera.position.y) * 0.1;
        camera.position.z += (idealCamZ - camera.position.z) * 0.1;
        camera.lookAt(car.x, car.y || 1.0, car.z);
      }
    }
  }

  return {
    get mode() { return mode; },
    set mode(v) { mode = v; },
    get car() { return car; },
    set car(v) { car = v; },
    get health() { return health; },
    set health(v) { health = v; },
    get mesh() { return mesh; },
    get x() { return x; },
    set x(v) { x = v; },
    get z() { return z; },
    set z(v) { z = v; },
    get heading() { return heading; },
    set heading(v) { heading = v; },
    get autopilot() { return autopilot; },
    set autopilot(v) { autopilot = v; },
    get pos() { return { x, z, heading }; },
    isDriving() { return mode === 'car'; },
    init,
    update,
    damage,
    heal,
    respawn
  };
})();
