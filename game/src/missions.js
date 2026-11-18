window.VB = window.VB || {};

window.VB.missions = (function() {
  let index = 0;
  let phase = 'offer'; // 'offer' | 'active' | 'between' | 'done'
  let objective = '';
  let targetPos = null;
  let dialog = null;
  let timer = null;

  let currentMissionCar = null;
  let currentStepIdx = 0;
  let activeStep = null;
  let stepState = 'headingToPickup'; // 'headingToPickup' | 'headingToTarget' | 'active'

  let healthPackMesh = null;
  let healthPackPos = null;
  let healthPackActive = false;

  let markerGroup = null;
  let cylinderMesh = null;
  let ringMesh = null;

  let sideJobActive = false;
  let currentSideJob = null;

  function createRandom(seed) {
    let s = seed | 0;
    return function() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rng = createRandom(20261118 + 999);

  function getLandmark(name) {
    if (VB.landmarks && VB.landmarks[name]) {
      return VB.landmarks[name];
    }
    return { x: 0, z: 0, r: 10 };
  }

  function getGiverLandmark(mission) {
    if (mission && mission.giver && mission.giver.landmark) {
      return getLandmark(mission.giver.landmark);
    }
    // Default giver for story/side jobs is fixerSpot
    return getLandmark('fixerSpot');
  }

  function getGiverLines(mission) {
    if (mission && mission.giver && mission.giver.lines) {
      return mission.giver.lines;
    }
    if (mission && mission.giverLine) {
      return [mission.giverLine];
    }
    return ['Take care of this job for me.'];
  }

  function removeMissionCar() {
    if (currentMissionCar) {
      if (VB.cars && typeof VB.cars.remove === 'function') {
        VB.cars.remove(currentMissionCar);
      }
      currentMissionCar = null;
    }
  }

  function cleanupActive() {
    removeMissionCar();
    if (VB.people && typeof VB.people.clearRivals === 'function') {
      VB.people.clearRivals();
    }
    if (VB.police && typeof VB.police.unlock === 'function') {
      VB.police.unlock();
    }
    healthPackActive = false;
    if (healthPackMesh) healthPackMesh.visible = false;
    timer = null;
  }

  function getSideJob() {
    const names = Object.keys(VB.landmarks || {}).filter(n => n !== 'heroStart' && n !== 'fixerSpot' && n !== 'hideout');
    const pickup = names[Math.floor(rng() * names.length)];
    let dropoff = pickup;
    while (dropoff === pickup) {
      dropoff = names[Math.floor(rng() * names.length)];
    }
    const lmP = getLandmark(pickup);
    const lmD = getLandmark(dropoff);
    const dist = Math.sqrt((lmP.x - lmD.x)**2 + (lmP.z - lmD.z)**2);
    const timeLimit = Math.round(dist / 12 + 30);
    return {
      id: 'side-job',
      title: 'Package Delivery',
      reward: 300,
      giver: { landmark: 'fixerSpot', lines: ['Got a quick drop for you across town. Make it snappy.'] },
      steps: [
        {
          type: 'pickupThenReach',
          pickup: pickup,
          target: dropoff,
          radius: 12,
          timeLimit: timeLimit,
          setStars: -1,
          spawnRivals: 0
        }
      ]
    };
  }

  function getCurrentMission() {
    const story = VB.story || [];
    if (index < story.length) {
      sideJobActive = false;
      return story[index];
    } else {
      sideJobActive = true;
      if (!currentSideJob) {
        currentSideJob = getSideJob();
      }
      return currentSideJob;
    }
  }

  function init() {
    index = VB.world && typeof VB.world.missionIndex === 'number' ? VB.world.missionIndex : 0;
    if (index >= 5) {
      phase = 'done';
      objective = 'Side jobs available at Fixer Spot';
    } else {
      phase = 'offer';
      const m = getCurrentMission();
      objective = `Meet fixer for mission: ${m.title}`;
    }

    if (VB.world && VB.world.scene) {
      const scene = VB.world.scene;
      markerGroup = new THREE.Group();

      const cylGeo = new THREE.CylinderGeometry(1.2, 1.2, 30, 16);
      cylGeo.translate(0, 15, 0);
      const cylMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      cylinderMesh = new THREE.Mesh(cylGeo, cylMat);
      markerGroup.add(cylinderMesh);

      const ringGeo = new THREE.RingGeometry(10, 11, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
      });
      ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = 0.05;
      markerGroup.add(ringMesh);

      scene.add(markerGroup);
      markerGroup.visible = false;

      // Health pack mesh: small white box with green cross
      const hpGroup = new THREE.Group();
      const boxGeo = new THREE.BoxGeometry(0.6, 0.4, 0.6);
      const boxMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const hpBox = new THREE.Mesh(boxGeo, boxMat);
      hpGroup.add(hpBox);

      const cross1Geo = new THREE.BoxGeometry(0.4, 0.08, 0.12);
      const crossMat = new THREE.MeshBasicMaterial({ color: 0x00cc44 });
      const c1 = new THREE.Mesh(cross1Geo, crossMat);
      c1.position.y = 0.22;
      hpGroup.add(c1);

      const cross2Geo = new THREE.BoxGeometry(0.12, 0.08, 0.4);
      const c2 = new THREE.Mesh(cross2Geo, crossMat);
      c2.position.y = 0.22;
      hpGroup.add(c2);

      healthPackMesh = hpGroup;
      healthPackMesh.visible = false;
      scene.add(healthPackMesh);
    }
  }

  function startMission() {
    const m = getCurrentMission();
    phase = 'active';
    currentStepIdx = 0;
    dialog = null;
    startStep(0);
  }

  function startStep(stepIdx) {
    const m = getCurrentMission();
    const steps = m.steps || [];
    if (stepIdx >= steps.length) {
      completeMission();
      return;
    }
    currentStepIdx = stepIdx;
    activeStep = steps[stepIdx];

    // Handle onStart properties
    const onStart = activeStep.onStart || activeStep; // fallback if properties are on step itself

    if (onStart.setStars !== undefined && onStart.setStars >= 0) {
      if (VB.police && typeof VB.police.setStars === 'function') {
        VB.police.setStars(onStart.setStars);
      }
    }

    if (activeStep.type === 'escape' || (m.id === 'hot-cargo' && stepIdx === 0)) {
      if (VB.police && typeof VB.police.setStars === 'function') {
        VB.police.setStars(3);
      }
      if (VB.police && typeof VB.police.lock === 'function') {
        VB.police.lock();
      }
    }
    if (m.id === 'duskline-getaway') {
      if (VB.police && typeof VB.police.setStars === 'function') {
        VB.police.setStars(4);
      }
      if (VB.police && typeof VB.police.lock === 'function') {
        VB.police.lock();
      }
    }

    if (activeStep.spawnRivals && activeStep.spawnRivals > 0) {
      const lm = getLandmark(activeStep.target);
      if (VB.people && typeof VB.people.spawnRival === 'function') {
        for (let i = 0; i < activeStep.spawnRivals; i++) {
          const angle = (i / activeStep.spawnRivals) * Math.PI * 2;
          const rx = lm.x + Math.sin(angle) * 8;
          const rz = lm.z + Math.cos(angle) * 8;
          VB.people.spawnRival(rx, rz);
        }
      }
    }

    // Health pack spawn
    if (onStart.healthPack || activeStep.healthPack) {
      const lm = getLandmark(activeStep.target);
      healthPackPos = { x: lm.x, z: lm.z };
      if (healthPackMesh) {
        healthPackMesh.position.set(lm.x, 0, lm.z);
        healthPackMesh.visible = true;
      }
      healthPackActive = true;
    } else {
      healthPackActive = false;
      if (healthPackMesh) healthPackMesh.visible = false;
    }

    // Mission car spawn if needed
    if (m.needsCar && currentStepIdx === 0 && !currentMissionCar) {
      if (VB.cars && typeof VB.cars.spawnScripted === 'function') {
        currentMissionCar = VB.cars.spawnScripted({
          kind: m.needsCar.kind || 'sedan',
          color: m.needsCar.color || 0xcccccc,
          atLandmark: m.needsCar.atLandmark
        });
      }
    }

    // Determine targetPos and stepState
    if (activeStep.type === 'pickupThenReach' && activeStep.pickup) {
      stepState = 'headingToPickup';
      const plm = getLandmark(activeStep.pickup);
      targetPos = { x: plm.x, z: plm.z };
      objective = `Go to pickup: ${activeStep.pickup}`;
      timer = null; // timer runs from pickup
    } else {
      stepState = 'headingToTarget';
      const tlm = getLandmark(activeStep.target);
      targetPos = { x: tlm.x, z: tlm.z };
      objective = `Reach target: ${activeStep.target} (${m.title})`;
      timer = activeStep.timeLimit > 0 ? activeStep.timeLimit : null;
    }
  }

  function completeMission() {
    const m = getCurrentMission();
    const reward = m.reward || 1000;

    if (VB.world && typeof VB.world.addCash === 'function') {
      VB.world.addCash(reward);
    }
    if (VB.audio) {
      if (typeof VB.audio.success === 'function') VB.audio.success();
      if (typeof VB.audio.cash === 'function') VB.audio.cash();
    }
    if (VB.hud && typeof VB.hud.toast === 'function') {
      VB.hud.toast(`Mission complete: ${m.title} +$${reward}`);
    }

    cleanupActive();

    index++;
    if (VB.world) {
      VB.world.missionIndex = index;
    }

    // Save progress
    try {
      const pPos = VB.player && VB.player.pos ? VB.player.pos : { x: 40, z: -38, heading: 0 };
      if (VB.save && typeof VB.save.store === 'function') {
        VB.save.store({
          v: 1,
          cash: VB.world ? VB.world.cash : 0,
          missionIndex: index,
          playerPos: pPos
        });
      }
    } catch {}

    const story = VB.story || [];
    if (index >= story.length) {
      phase = 'done';
      sideJobActive = true;
      currentSideJob = null;
      objective = 'Side jobs available at Fixer Spot';
      if (VB.world && typeof VB.world.setState === 'function') {
        VB.world.setState('complete');
      }
      if (VB.hud && typeof VB.hud.banner === 'function') {
        VB.hud.banner('DEBT CLEARED', 'Vesper Bay is yours now, Rafa.');
      }
    } else {
      phase = 'offer';
      const nextM = getCurrentMission();
      objective = `Meet fixer for mission: ${nextM.title}`;
    }
  }

  function failMission(reason) {
    if (VB.hud && typeof VB.hud.toast === 'function') {
      VB.hud.toast(reason || 'Mission failed');
    }
    cleanupActive();
    phase = 'offer';
    const m = getCurrentMission();
    objective = `Meet fixer for mission: ${m.title}`;
  }

  function update(dt) {
    if (!VB.world || (VB.world.state !== 'playing' && VB.world.state !== 'shot')) {
      return;
    }

    const px = VB.player ? VB.player.x : 0;
    const pz = VB.player ? VB.player.z : 0;

    // Health pack pickup check
    if (healthPackActive && healthPackPos) {
      const hdx = px - healthPackPos.x;
      const hdz = pz - healthPackPos.z;
      if (Math.sqrt(hdx * hdx + hdz * hdz) <= 2 && VB.player && VB.player.mode === 'foot') {
        if (typeof VB.player.heal === 'function') {
          VB.player.heal(50);
        }
        healthPackActive = false;
        if (healthPackMesh) healthPackMesh.visible = false;
        if (VB.audio && typeof VB.audio.cash === 'function') {
          VB.audio.cash();
        }
      }
    }

    const giver = sideJobActive && currentSideJob ? getGiverLandmark(currentSideJob) : getGiverLandmark(getCurrentMission());
    const giverRadius = giver.r || 6;

    if (phase === 'offer') {
      targetPos = { x: giver.x, z: giver.z };
      if (markerGroup) {
        markerGroup.position.set(targetPos.x, 0, targetPos.z);
        markerGroup.visible = true;
        if (ringMesh) {
          ringMesh.geometry.dispose();
          ringMesh.geometry = new THREE.RingGeometry(giverRadius, giverRadius + 1, 32);
          ringMesh.geometry.rotateX(-Math.PI / 2);
        }
      }

      const dx = px - giver.x;
      const dz = pz - giver.z;
      const distToGiver = Math.sqrt(dx * dx + dz * dz);

      const m = sideJobActive && currentSideJob ? currentSideJob : getCurrentMission();
      const lines = getGiverLines(m);

      if (distToGiver <= giverRadius) {
        dialog = {
          lines: lines,
          hint: 'Press E to accept'
        };
        objective = `Press E to accept: ${m.title}`;
        if (VB.input && typeof VB.input.pressed === 'function' && VB.input.pressed('KeyE')) {
          if (sideJobActive) {
            phase = 'active';
            currentStepIdx = 0;
            startStep(0);
          } else {
            startMission();
          }
          dialog = null;
        }
      } else {
        dialog = null;
        objective = `Meet fixer for mission: ${m.title}`;
      }
    } else if (phase === 'active') {
      dialog = null;
      if (targetPos && markerGroup) {
        markerGroup.position.set(targetPos.x, 0, targetPos.z);
        markerGroup.visible = true;
        const radius = activeStep ? (activeStep.radius || 12) : 12;
        if (ringMesh) {
          ringMesh.geometry.dispose();
          ringMesh.geometry = new THREE.RingGeometry(radius, radius + 1, 32);
          ringMesh.geometry.rotateX(-Math.PI / 2);
        }
      }

      // Timer countdown
      if (timer !== null) {
        timer -= dt;
        if (timer <= 0) {
          timer = 0;
          failMission('Mission failed: Time expired');
          return;
        }
      }

      // Check step completion
      if (activeStep.type === 'pickupThenReach' && stepState === 'headingToPickup') {
        const plm = getLandmark(activeStep.pickup);
        const pdx = px - plm.x;
        const pdz = pz - plm.z;
        const pradius = activeStep.radius || 12;
        if (Math.sqrt(pdx * pdx + pdz * pdz) <= pradius) {
          // Reached pickup, now head to target
          stepState = 'headingToTarget';
          const tlm = getLandmark(activeStep.target);
          targetPos = { x: tlm.x, z: tlm.z };
          objective = `Deliver to: ${activeStep.target}`;
          timer = activeStep.timeLimit > 0 ? activeStep.timeLimit : null;
          if (VB.audio && typeof VB.audio.cash === 'function') {
            VB.audio.cash();
          }
        }
      } else if (activeStep.type === 'clearRivals') {
        const tlm = getLandmark(activeStep.target);
        const tdx = px - tlm.x;
        const tdz = pz - tlm.z;
        const radius = activeStep.radius || 30;
        if (Math.sqrt(tdx * tdx + tdz * tdz) <= radius) {
          if (VB.people && typeof VB.people.updateRivals === 'function') {
            VB.people.updateRivals(dt, { x: px, z: pz });
          }
          if (VB.people && typeof VB.people.rivalsAlive === 'function' && VB.people.rivalsAlive() === 0) {
            startStep(currentStepIdx + 1);
          }
        }
      } else if (activeStep.type === 'deliverCar') {
        // Player must be driving the mission car into target radius
        const tlm = getLandmark(activeStep.target);
        const radius = activeStep.radius || 14;
        let carCheck = currentMissionCar;
        if (carCheck) {
          const cdx = carCheck.x - tlm.x;
          const cdz = carCheck.z - tlm.z;
          const inRadius = Math.sqrt(cdx * cdx + cdz * cdz) <= radius;
          const isDriving = VB.player && VB.player.car === carCheck;
          if (inRadius && isDriving) {
            startStep(currentStepIdx + 1);
          }
        }
      } else if (activeStep.type === 'escape') {
        const tlm = getLandmark(activeStep.target);
        const tdx = px - tlm.x;
        const tdz = pz - tlm.z;
        const radius = activeStep.radius || 16;
        if (Math.sqrt(tdx * tdx + tdz * tdz) <= radius) {
          // Entering target radius unlocks police so decay can run
          if (VB.police && typeof VB.police.unlock === 'function') {
            VB.police.unlock();
          }
          if (VB.police && VB.police.stars === 0) {
            startStep(currentStepIdx + 1);
          }
        }
      } else {
        // standard reach or pickupThenReach target phase
        const tlm = getLandmark(activeStep.target);
        const tdx = px - tlm.x;
        const tdz = pz - tlm.z;
        const radius = activeStep.radius || 12;
        if (Math.sqrt(tdx * tdx + tdz * tdz) <= radius) {
          startStep(currentStepIdx + 1);
        }
      }
    } else {
      if (markerGroup) markerGroup.visible = false;
    }
  }

  function forceState(i, phaseName) {
    index = i;
    if (VB.world) {
      VB.world.missionIndex = i;
    }
    if (phaseName === 'offer') {
      cleanupActive();
      phase = 'offer';
      sideJobActive = (index >= 5);
      const m = getCurrentMission();
      objective = `Meet fixer for mission: ${m.title}`;
    } else if (phaseName === 'active') {
      sideJobActive = (index >= 5);
      const m = getCurrentMission();
      phase = 'active';
      currentStepIdx = 0;
      startStep(0);
    }
  }

  function onWasted() {
    cleanupActive();
    if (index < (VB.story || []).length) {
      phase = 'offer';
      const m = getCurrentMission();
      objective = `Meet fixer for mission: ${m.title}`;
    }
  }

  function restart(kind) {
    if (VB.police && typeof VB.police.reset === 'function') {
      VB.police.reset();
    }
    if (VB.player && typeof VB.player.respawn === 'function') {
      if (kind === 'busted') {
        VB.player.respawn('policeStation');
      } else {
        VB.player.respawn('hospital');
      }
    }
    onWasted();
    if (VB.world && typeof VB.world.setState === 'function') {
      VB.world.setState('playing');
    }
  }

  return {
    get index() { return index; },
    set index(v) { index = v; },
    get phase() { return phase; },
    set phase(v) { phase = v; },
    get objective() { return objective; },
    get targetPos() { return targetPos; },
    get dialog() { return dialog; },
    get timer() { return timer; },
    init,
    update,
    forceState,
    onWasted,
    restart
  };
})();
