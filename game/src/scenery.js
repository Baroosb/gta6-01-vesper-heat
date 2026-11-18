window.VB = window.VB || {};

window.VB.scenery = (function() {
  let sunLight = null;
  let sunTarget = null;
  let waterMat = null;

  function followShadow(x, z) {
    if (sunLight && sunTarget) {
      sunLight.position.set(x - 220, 150, z + 140);
      sunTarget.position.set(x, 0, z);
      sunLight.target = sunTarget;
    }
  }

  function createSkyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#2e4a7a');   // zenith
    grad.addColorStop(0.65, '#ff9a3c');  // horizon
    grad.addColorStop(0.85, '#e8804f');  // warm band
    grad.addColorStop(1.0, '#15101a');   // ground fade

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  function init(scene) {
    const colors = VB.config.colors;

    // 1. Sky Sphere
    const skyGeo = new THREE.SphereGeometry(1500, 32, 15);
    const skyMat = new THREE.MeshBasicMaterial({
      map: createSkyTexture(),
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Fog
    scene.fog = new THREE.Fog(colors.fog, 140, 700);

    // 2. Lights
    const hemiLight = new THREE.HemisphereLight(colors.hemiSky, colors.hemiGround, 0.75);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(colors.sun, 1.15);
    sunLight.position.set(-220, 150, 140);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 600;
    const d = 65;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    sunTarget = new THREE.Object3D();
    scene.add(sunTarget);
    sunLight.target = sunTarget;

    const ambientLight = new THREE.AmbientLight(0x332a38, 0.25);
    scene.add(ambientLight);

    // 3. Water Plane (z 340 to 1000, x -800..800, y -0.35)
    waterMat = new THREE.MeshStandardMaterial({
      color: colors.water,
      roughness: 0.1,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88
    });
    VB.scenery.waterMat = waterMat;

    const waterGeo = new THREE.PlaneGeometry(1600, 660);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(0, -0.35, 670);
    scene.add(water);

    // 4. Sand Strip (x -400..400, z 340..372, y 0.01)
    const sandGeo = new THREE.PlaneGeometry(800, 32);
    sandGeo.rotateX(-Math.PI / 2);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xd4b572, roughness: 0.9 });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.position.set(0, 0.01, 356);
    sand.receiveShadow = true;
    scene.add(sand);

    // 5. Marina (wooden piers & boats)
    const pierMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
    const pierXPositions = [-180, -90, 0, 90, 190];
    for (const px of pierXPositions) {
      const pierGeo = new THREE.BoxGeometry(4, 0.3, 40);
      const pier = new THREE.Mesh(pierGeo, pierMat);
      pier.position.set(px, 0.15, 340);
      pier.receiveShadow = true;
      scene.add(pier);
    }

    // 6 Simple Boats
    const boatColors = [0xd8a928, 0x3a4149, 0xb83a3a, 0x3a6cb8, 0x4a4a4a, 0xffffff];
    for (let b = 0; b < 6; b++) {
      const isLandmarkBoat = (b === 5);
      const bx = -150 + b * 65;
      const bz = 350 + (b % 2) * 15;
      const bColor = isLandmarkBoat ? 0xffffff : boatColors[b];

      const hullMat = new THREE.MeshStandardMaterial({ color: bColor, roughness: 0.4 });
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 6.0), hullMat);
      hull.position.set(bx, 0.2, bz);
      hull.castShadow = true;
      scene.add(hull);

      const cabinMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 });
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 2.5), cabinMat);
      cabin.position.set(bx, 0.9, bz - 0.5);
      scene.add(cabin);

      const mastMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.5), mastMat);
      mast.position.set(bx, 2.2, bz);
      scene.add(mast);
    }

    // 6. Palms (~60 palm trees)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e503b, roughness: 0.9 });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x356835, roughness: 0.7 });

    for (let p = 0; p < 60; p++) {
      // Scatter along quay, beach edge, sidewalks
      const pz = 260 + (p % 12) * 8 + (p * 13) % 5;
      const px = -250 + (p * 47) % 500;
      if (Math.abs(px) < 12 && pz < 267) continue; // skip central avenue road

      const treeGroup = new THREE.Group();
      treeGroup.position.set(px, 0.1, pz);

      // Trunk segments
      const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.5), trunkMat);
      seg1.position.set(0, 1.25, 0);
      seg1.rotation.z = 0.1;
      treeGroup.add(seg1);

      const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.5), trunkMat);
      seg2.position.set(0.25, 3.7, 0);
      seg2.rotation.z = -0.05;
      treeGroup.add(seg2);

      // Fronds
      for (let f = 0; f < 6; f++) {
        const frond = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.05, 0.6), frondMat);
        frond.position.set(0.25, 5.0, 0);
        frond.rotation.y = (f * Math.PI) / 3;
        frond.rotation.z = 0.3;
        treeGroup.add(frond);
      }

      scene.add(treeGroup);
    }

    // 7. Neon Signs (~14 thin boxes with emissive material)
    const neonColors = [colors.neonPink, colors.neonCyan, 0xff3366, 0x33ffcc, 0xffcc33];
    for (let n = 0; n < 14; n++) {
      const nx = -200 + (n * 37) % 400;
      const nz = -200 + (n * 53) % 400;
      const nColor = neonColors[n % neonColors.length];

      const signGeo = new THREE.BoxGeometry(3.5, 1.2, 0.2);
      const signMat = new THREE.MeshBasicMaterial({ color: nColor });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(nx, 4.0, nz);
      scene.add(sign);
    }

    // 8. Distant Skyline (ring of dark silhouette boxes at radius 700-900m)
    const skylineMat = new THREE.MeshBasicMaterial({ color: 0x12151c });
    for (let s = 0; s < 36; s++) {
      const angle = (s / 36) * Math.PI * 2;
      const radius = 750 + (s % 3) * 60;
      const sx = Math.cos(angle) * radius;
      const sz = Math.sin(angle) * radius;
      const sw = 40 + (s * 17) % 30;
      const sh = 80 + (s * 31) % 120;

      const silGeo = new THREE.BoxGeometry(sw, sh, sw);
      silGeo.translate(0, sh / 2, 0);
      const sil = new THREE.Mesh(silGeo, skylineMat);
      sil.position.set(sx, 0, sz);
      scene.add(sil);
    }
  }

  return {
    init,
    followShadow
  };
})();
