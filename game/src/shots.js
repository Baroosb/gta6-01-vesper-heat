window.VB = window.VB || {};

window.VB.shots = (function() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');

  if (!name) {
    return { name: null };
  }

  window.VB.shots = { name };

  window.addEventListener('load', () => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const ready = window.VB &&
                    window.VB.world &&
                    window.VB.player &&
                    window.VB.missions &&
                    window.VB.cars;
      if (ready || attempts > 100) {
        clearInterval(interval);
        if (ready) {
          runStaging(name);
        } else {
          window.__SHOT_ERROR = 'Timeout waiting for game modules';
        }
      }
    }, 100);
  });

  function runStaging(shotName) {
    try {
      VB.world.shotMode = true;
      VB.world.setState('shot');

      const step = (n) => {
        for (let i = 0; i < n; i++) {
          VB.world.step(1 / 60);
        }
      };

      const setCam = (x, y, z, lx, ly, lz) => {
        VB.world.camera.position.set(x, y, z);
        VB.world.camera.lookAt(lx, ly, lz);
      };

      const finish = () => {
        VB.world.renderer.render(VB.world.scene, VB.world.camera);
        window.__SHOT_READY = true;
      };

      if (shotName === 'vista') {
        const hero = VB.cars.heroCar;
        if (hero) {
          hero.x = -120;
          hero.z = 322;
          hero.heading = -Math.PI / 2;
          hero.speed = 0;
          hero.mesh.position.set(-120, 0, 322);
          hero.mesh.rotation.y = -Math.PI / 2;
        }
        VB.player.mode = 'foot';
        VB.player.car = null;
        VB.player.x = -117.5;
        VB.player.z = 318;
        const targetDx = -120 - (-117.5);
        const targetDz = 322 - 318;
        const pHeading = Math.atan2(-targetDx, -targetDz);
        VB.player.heading = pHeading;
        if (VB.player.mesh) {
          VB.player.mesh.visible = true;
          VB.player.mesh.position.set(-117.5, 0, 318);
          VB.player.mesh.rotation.y = pHeading;
        }
        const carA = VB.cars.spawnScripted({ kind: 'coupe', color: 0xe2725b, x: -185, z: 311, heading: Math.PI / 2 });
        if (carA) {
          carA.avenue = { axis: 'x', at: 318 };
          carA.dir = -1;
          carA.speed = 11;
          carA.targetSpeed = 11;
          carA.parked = false;
        }
        const carB = VB.cars.spawnScripted({ kind: 'sedan', color: 0x224488, x: -55, z: 325, heading: -Math.PI / 2 });
        if (carB) {
          carB.avenue = { axis: 'x', at: 318 };
          carB.dir = 1;
          carB.speed = 11;
          carB.targetSpeed = 11;
          carB.parked = false;
        }
        step(60);
        setCam(-134, 3.4, 339, -96, 2.5, 298);
        finish();
      } else if (shotName === 'drive') {
        VB.missions.forceState(0, 'active');
        const hero = VB.cars.heroCar;
        if (hero) {
          hero.x = 37;
          hero.z = 120;
          hero.heading = 0;
          hero.speed = 10;
          hero.mesh.position.set(37, 0, 120);
          hero.mesh.rotation.y = 0;
          VB.player.car = hero;
          VB.player.mode = 'car';
          hero.drivenByPlayer = true;
          if (VB.player.mesh) VB.player.mesh.visible = false;
          VB.player.autopilot = { throttle: 0.75, steer: 0 };
        }
        for (let i = 0; i < 24; i++) {
          step(10);
          if (hero) {
            const h = hero.heading;
            const fx = -Math.sin(h);
            const fz = -Math.cos(h);
            setCam(hero.x - fx * 7.5, 2.8, hero.z - fz * 7.5, hero.x + fx * 8, 1.0, hero.z + fz * 8);
          }
        }
        const hz = hero ? hero.z : 120;
        const carA = VB.cars.spawnScripted({ kind: 'coupe', color: 0xe2725b, x: 40.8, z: hz - 26, heading: 0 });
        if (carA) {
          carA.avenue = { axis: 'z', at: 37 };
          carA.dir = -1;
          carA.speed = 11;
          carA.targetSpeed = 11;
          carA.parked = false;
        }
        VB.cars.spawnScripted({ kind: 'convertible', color: 0xf2e394, x: 31.2, z: hz - 13, heading: 0 });
        VB.cars.spawnScripted({ kind: 'truck', color: 0x7fb2e5, x: 43.8, z: hz - 44, heading: Math.PI });
        const sedan = VB.cars.spawnScripted({ kind: 'sedan', color: 0x224488, x: 33.2, z: hz - 20, heading: Math.PI });
        if (sedan) {
          sedan.avenue = { axis: 'z', at: 37 };
          sedan.dir = 1;
          sedan.speed = 11;
          sedan.targetSpeed = 11;
          sedan.parked = false;
        }
        VB.cars.spawnScripted({ kind: 'pickup', color: 0x7fc8a9, x: 43.8, z: hz + 10, heading: 0 });
        finish();
      } else if (shotName === 'chase') {
        VB.missions.forceState(2, 'active');
        const hero = VB.cars.heroCar;
        if (hero) {
          hero.x = -37;
          hero.z = 140;
          hero.heading = 0;
          hero.speed = 12;
          hero.mesh.position.set(-37, 0, 140);
          hero.mesh.rotation.y = 0;
          VB.player.car = hero;
          VB.player.mode = 'car';
          hero.drivenByPlayer = true;
          if (VB.player.mesh) VB.player.mesh.visible = false;
          VB.player.autopilot = { throttle: 0.85, steer: 0 };
        }
        VB.police.setStars(4);

        const coupeChase = VB.cars.spawnScripted({ kind: 'coupe', color: 0xe2725b, x: -37, z: 110, heading: 0 });
        if (coupeChase) {
          coupeChase.avenue = { axis: 'z', at: -37 };
          coupeChase.dir = -1;
          coupeChase.speed = 11;
          coupeChase.targetSpeed = 11;
          coupeChase.parked = false;
        }

        for (let chunk = 0; chunk < 6; chunk++) {
          step(10);
          if (hero && VB.cars && VB.cars.all) {
            let count = 0;
            for (const c of VB.cars.all) {
              if (c.isPolice) {
                const dist = Math.sqrt((c.x - hero.x)**2 + (c.z - hero.z)**2);
                if (dist <= 45) count++;
              }
            }
            if (count >= 2) break;
          }
        }
        for (let i = 0; i < 3; i++) {
          step(10);
        }

        if (hero && VB.cars && VB.cars.all) {
          let nearestPolice = null;
          let secondNearestPolice = null;
          let minDist = Infinity;
          let secondMinDist = Infinity;
          for (const c of VB.cars.all) {
            if (c.isPolice) {
              const dist = Math.sqrt((c.x - hero.x)**2 + (c.z - hero.z)**2);
              if (dist < minDist) {
                secondMinDist = minDist;
                secondNearestPolice = nearestPolice;
                minDist = dist;
                nearestPolice = c;
              } else if (dist < secondMinDist) {
                secondMinDist = dist;
                secondNearestPolice = c;
              }
            }
          }
          if (nearestPolice) {
            const h = hero.heading;
            const fx = -Math.sin(h);
            const fz = -Math.cos(h);
            const rx = Math.cos(h);
            const rz = -Math.sin(h);
            const intX = hero.x + fx * 14 + rx * 6;
            const intZ = hero.z + fz * 14 + rz * 6;
            const pDx = hero.x - intX;
            const pDz = hero.z - intZ;
            const intHeading = Math.atan2(-pDx, -pDz);

            nearestPolice.x = intX;
            nearestPolice.z = intZ;
            nearestPolice.heading = intHeading;
            nearestPolice.speed = 0;
            if (nearestPolice.mesh) {
              nearestPolice.mesh.position.set(intX, 0, intZ);
              nearestPolice.mesh.rotation.y = intHeading;
            }
          }
          if (secondNearestPolice) {
            const h = hero.heading;
            const fx = -Math.sin(h);
            const fz = -Math.cos(h);
            const rx = Math.cos(h);
            const rz = -Math.sin(h);
            const intX2 = hero.x + fx * 12 - rx * 6;
            const intZ2 = hero.z + fz * 12 - rz * 6;
            const pDx2 = hero.x - intX2;
            const pDz2 = hero.z - intZ2;
            const intHeading2 = Math.atan2(-pDx2, -pDz2);

            secondNearestPolice.x = intX2;
            secondNearestPolice.z = intZ2;
            secondNearestPolice.heading = intHeading2;
            secondNearestPolice.speed = 0;
            if (secondNearestPolice.mesh) {
              secondNearestPolice.mesh.position.set(intX2, 0, intZ2);
              secondNearestPolice.mesh.rotation.y = intHeading2;
            }
          }
        }

        if (hero) {
          const h = hero.heading;
          const fx = -Math.sin(h);
          const fz = -Math.cos(h);
          setCam(hero.x - fx * 7.5, 2.8, hero.z - fz * 7.5, hero.x + fx * 8, 1.5, hero.z + fz * 8);
        }
        if (VB.fx) {
          const h = hero.heading;
          const fx = -Math.sin(h);
          const fz = -Math.cos(h);
          const rx = Math.cos(h);
          const rz = -Math.sin(h);
          for (let i = 0; i < 8; i++) {
            const bx = hero.x - fx * (2 + i * 1.6);
            const bz = hero.z - fz * (2 + i * 1.6);
            VB.fx.skid(bx + rx * 0.95, bz + rz * 0.95, h, 1.7);
            VB.fx.skid(bx - rx * 0.95, bz - rz * 0.95, h, 1.7);
          }
          VB.fx.sparks(hero.x + fx * 2.2 + rx * 0.9, 0.5, hero.z + fz * 2.2 + rz * 0.9, 40);
        }
        VB.fx.exhaust(hero);
        VB.fx.exhaust(hero);
        VB.fx.exhaust(hero);
        finish();
      } else if (shotName === 'race') {
        const hero = VB.cars.heroCar;
        if (hero) {
          hero.x = -30;
          hero.z = 314.2;
          hero.heading = Math.PI / 2;
          hero.speed = 15;
          hero.mesh.position.set(-30, 0, 314.2);
          hero.mesh.rotation.y = Math.PI / 2;
          VB.player.car = hero;
          VB.player.mode = 'car';
          hero.drivenByPlayer = true;
          if (VB.player.mesh) VB.player.mesh.visible = false;
          VB.player.autopilot = { throttle: 0.85, steer: 0 };
        }
        VB.missions.startRace();
        VB.cars.spawnScripted({ kind: 'convertible', color: 0xe2725b, x: -72, z: 301, heading: Math.PI / 2 });
        VB.cars.spawnScripted({ kind: 'pickup', color: 0x7fc8a9, x: -92, z: 302, heading: Math.PI / 2 });
        for (let i = 0; i < 5; i++) {
          step(10);
          if (hero) {
            const h = hero.heading;
            const fx = -Math.sin(h);
            const fz = -Math.cos(h);
            setCam(hero.x - fx * 7.5, 2.8, hero.z - fz * 7.5, hero.x + fx * 9, 1.1, hero.z + fz * 9);
          }
        }
        finish();
      } else if (shotName === 'mission') {
        VB.missions.forceState(3, 'active');
        const docks = VB.landmarks && VB.landmarks.docks ? VB.landmarks.docks : { x: -200, z: 300 };
        const px = docks.x + 11;
        const pz = docks.z + 11;
        const dx = docks.x - px;
        const dz = docks.z - pz;
        const heading = Math.atan2(-dx, -dz);

        VB.player.mode = 'foot';
        VB.player.car = null;
        VB.player.x = px;
        VB.player.z = pz;
        VB.player.heading = heading;
        if (VB.player.mesh) {
          VB.player.mesh.visible = true;
          VB.player.mesh.position.set(px, 0, pz);
          VB.player.mesh.rotation.y = heading;
        }

        VB.cars.spawnScripted({ kind: 'coupe', color: 0x338833, x: docks.x + 8, z: docks.z + 8, heading: 0 });

        for (let chunk = 0; chunk < 10; chunk++) {
          step(10);
        }
        const fx = -Math.sin(heading);
        const fz = -Math.cos(heading);
        setCam(px - fx * 7, 2.6, pz - fz * 7, docks.x, 1.2, docks.z);
        finish();
      } else {
        setCam(40, 15, -20, 40, 0, -38);
        finish();
      }
    } catch (e) {
      window.__SHOT_ERROR = e.message || String(e);
      try {
        VB.world.renderer.render(VB.world.scene, VB.world.camera);
        window.__SHOT_READY = true;
      } catch {}
    }
  }

  return VB.shots;
})();
