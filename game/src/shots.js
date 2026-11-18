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
          hero.x = 26;
          hero.z = 296;
          hero.heading = -0.5;
          hero.speed = 0;
          hero.mesh.position.set(26, 0, 296);
          hero.mesh.rotation.y = -0.5;
        }
        VB.player.mode = 'foot';
        VB.player.car = null;
        VB.player.x = 31.5;
        VB.player.z = 292;
        const targetDx = 26 - 31.5;
        const targetDz = 296 - 292;
        const pHeading = Math.atan2(-targetDx, -targetDz);
        VB.player.heading = pHeading;
        if (VB.player.mesh) {
          VB.player.mesh.visible = true;
          VB.player.mesh.position.set(31.5, 0, 292);
          VB.player.mesh.rotation.y = pHeading;
        }
        step(90);
        setCam(52, 19, 330, -10, 8, 20);
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
        VB.police.setStars(3);

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
          let minDist = Infinity;
          for (const c of VB.cars.all) {
            if (c.isPolice) {
              const dist = Math.sqrt((c.x - hero.x)**2 + (c.z - hero.z)**2);
              if (dist < minDist) {
                minDist = dist;
                nearestPolice = c;
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
        }

        if (hero) {
          const h = hero.heading;
          const fx = -Math.sin(h);
          const fz = -Math.cos(h);
          setCam(hero.x - fx * 7.5, 2.8, hero.z - fz * 7.5, hero.x + fx * 8, 1.5, hero.z + fz * 8);
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

        for (let chunk = 0; chunk < 10; chunk++) {
          step(10);
        }
        const fx = -Math.sin(heading);
        const fz = -Math.cos(heading);
        setCam(px - fx * 5.5, 2.1, pz - fz * 5.5, docks.x, 1.2, docks.z);
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
