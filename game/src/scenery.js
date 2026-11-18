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
    grad.addColorStop(0.0, '#22355e');
    grad.addColorStop(0.38, '#6e4470');
    grad.addColorStop(0.60, '#e86a4a');
    grad.addColorStop(0.78, '#ff9a3c');
    grad.addColorStop(0.90, '#ffc46b');
    grad.addColorStop(1.0, '#15101a');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i <= 45; i++) {
      const x = (i * 173) % 512;
      const y = (i * 97) % 200;
      const radius = 1 + ((i * 3) % 7) * 0.1;
      const alpha = 0.25 + ((i * 7) % 10) / 20;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  function buildPalm(px, pz) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e503b, roughness: 0.9 });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x356835, roughness: 0.7 });

    const treeGroup = new THREE.Group();
    treeGroup.position.set(px, 0.1, pz);

    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.5), trunkMat);
    seg1.position.set(0, 1.25, 0);
    seg1.rotation.z = 0.1;
    treeGroup.add(seg1);

    const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.5), trunkMat);
    seg2.position.set(0.25, 3.7, 0);
    seg2.rotation.z = -0.05;
    treeGroup.add(seg2);

    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.05, 0.6), frondMat);
      frond.position.set(0.25, 5.0, 0);
      frond.rotation.y = (f * Math.PI) / 3;
      frond.rotation.z = 0.3;
      treeGroup.add(frond);
    }

    return treeGroup;
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

    // 2. Sun Disc and Glow
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 256;
    glowCanvas.height = 256;
    const glowCtx = glowCanvas.getContext('2d');
    const glowGrad = glowCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
    glowGrad.addColorStop(0, 'rgba(255,240,200,0.9)');
    glowGrad.addColorStop(1, 'rgba(255,240,200,0)');
    glowCtx.fillStyle = glowGrad;
    glowCtx.fillRect(0, 0, 256, 256);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);

    const sunDiscGeo = new THREE.CircleGeometry(58, 32);
    const sunDiscMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false });
    const sunDisc = new THREE.Mesh(sunDiscGeo, sunDiscMat);
    sunDisc.position.set(-980, 300, 640);
    sunDisc.lookAt(0, 60, 0);
    scene.add(sunDisc);

    const glowPlaneGeo = new THREE.PlaneGeometry(430, 430);
    const glowPlaneMat = new THREE.MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    const glowPlane = new THREE.Mesh(glowPlaneGeo, glowPlaneMat);
    glowPlane.position.set(-980, 300, 640);
    glowPlane.lookAt(0, 60, 0);
    scene.add(glowPlane);

    // 3. Clouds
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 256;
    cloudCanvas.height = 128;
    const cloudCtx = cloudCanvas.getContext('2d');
    for (let c = 0; c < 14; c++) {
      const cx = 64 + (c * 37) % 128;
      const cy = 32 + (c * 19) % 64;
      const cr = 30 + (c * 13) % 40;
      const alpha = 0.16 + ((c * 7) % 15) / 100;
      const cGrad = cloudCtx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      cGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      cGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      cloudCtx.fillStyle = cGrad;
      cloudCtx.beginPath();
      cloudCtx.arc(cx, cy, cr, 0, Math.PI * 2);
      cloudCtx.fill();
    }
    const cloudTexture = new THREE.CanvasTexture(cloudCanvas);

    for (let i = 0; i < 12; i++) {
      const cWidth = 200 + (i * 53) % 230;
      const cHeight = 46 + (i * 19) % 38;
      const cloudGeo = new THREE.PlaneGeometry(cWidth, cHeight);
      const cloudMat = new THREE.MeshBasicMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.5,
        color: 0xffc9a3,
        depthWrite: false,
        fog: false
      });
      const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
      const angle = (i / 12) * Math.PI * 2;
      const radius = 560 + (i % 3) * 130;
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      const cy = 165 + (i % 4) * 22;
      cloudMesh.position.set(cx, cy, cz);
      cloudMesh.lookAt(0, 150, 0);
      scene.add(cloudMesh);
    }

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

    // Water Sparkle
    const sparkleCanvas = document.createElement('canvas');
    sparkleCanvas.width = 256;
    sparkleCanvas.height = 256;
    const sparkleCtx = sparkleCanvas.getContext('2d');
    sparkleCtx.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 340; i++) {
      const sx = (i * 137) % 256;
      const sy = (i * 89) % 256;
      const swidth = 3 + (i * 7) % 7;
      const sheight = 1 + (i * 3) % 2;
      const alpha = 0.25 + ((i * 11) % 56) / 100;
      sparkleCtx.fillStyle = `rgba(255, 214, 150, ${alpha})`;
      sparkleCtx.fillRect(sx, sy, swidth, sheight);
    }
    const sparkleTexture = new THREE.CanvasTexture(sparkleCanvas);
    sparkleTexture.wrapS = THREE.RepeatWrapping;
    sparkleTexture.wrapT = THREE.RepeatWrapping;
    sparkleTexture.repeat.set(7, 3);

    const sparkleGeo = new THREE.PlaneGeometry(1600, 660);
    sparkleGeo.rotateX(-Math.PI / 2);
    const sparkleMat = new THREE.MeshBasicMaterial({
      map: sparkleTexture,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sparkleMesh = new THREE.Mesh(sparkleGeo, sparkleMat);
    sparkleMesh.position.set(0, -0.30, 670);
    scene.add(sparkleMesh);

    // 4. Sand Strip (x -400..400, z 340..372, y 0.01)
    const sandGeo = new THREE.PlaneGeometry(800, 32);
    sandGeo.rotateX(-Math.PI / 2);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xd4b572, roughness: 0.9 });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.position.set(0, 0.01, 356);
    sand.receiveShadow = true;
    scene.add(sand);

    // Beach Umbrellas
    const umbrellaColors = [0xff4fa3, 0x37e0d0, 0xffcc33, 0xff6b4a, 0x7fb2e5];
    for (let i = 0; i < 10; i++) {
      const ux = -260 + i * 58 + (i % 3) * 7;
      const uz = 348 + (i % 2) * 10;
      const colorIdx = i % umbrellaColors.length;
      const nextColorIdx = (i + 1) % umbrellaColors.length;

      const umbGroup = new THREE.Group();
      umbGroup.position.set(ux, 0, uz);

      const poleMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.8 });
      const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.2);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(0, 1.1, 0);
      umbGroup.add(pole);

      const coneMat = new THREE.MeshStandardMaterial({ color: umbrellaColors[colorIdx], roughness: 0.8 });
      const coneGeo = new THREE.ConeGeometry(1.7, 0.55, 8);
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(0, 2.3, 0);
      umbGroup.add(cone);

      const towelMat = new THREE.MeshStandardMaterial({ color: umbrellaColors[nextColorIdx], roughness: 0.8 });
      const towelGeo = new THREE.BoxGeometry(1.8, 0.04, 0.8);
      const towel = new THREE.Mesh(towelGeo, towelMat);
      towel.position.set(1.6, 0.05, 0);
      umbGroup.add(towel);

      scene.add(umbGroup);
    }

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

    // 6. Palms (~60 palm trees + boardwalk row)
    for (let p = 0; p < 60; p++) {
      const pz = 260 + (p % 12) * 8 + (p * 13) % 5;
      const px = -250 + (p * 47) % 500;
      if (Math.abs(px) < 12 && pz < 267) continue;

      const treeGroup = buildPalm(px, pz);
      scene.add(treeGroup);
    }

    for (let x = -252; x <= 252; x += 36) {
      scene.add(buildPalm(x, 336));
      scene.add(buildPalm(x + 18, 307));
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
