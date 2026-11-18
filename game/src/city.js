window.VB = window.VB || {};

window.VB.city = (function() {
  let colliders = [];
  let roadLines = [];
  let parkSpots = [];
  let sidewalkLoops = [];

  function createRng(seed) {
    let s = seed | 0;
    return function() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createWindowTexture(tintHex, litColorHex, darkColorHex, rows, cols) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Facade tint background
    ctx.fillStyle = tintHex;
    ctx.fillRect(0, 0, 256, 256);

    const cellW = 256 / cols;
    const cellH = 256 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW + cellW * 0.15;
        const y = r * cellH + cellH * 0.15;
        const w = cellW * 0.7;
        const h = cellH * 0.7;

        // pseudo-random lit state based on r and c
        const lit = ((r * 37 + c * 73) % 5) !== 0;
        ctx.fillStyle = lit ? litColorHex : darkColorHex;
        ctx.fillRect(x, y, w, h);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  function init(scene) {
    colliders.length = 0;
    roadLines.length = 0;
    parkSpots.length = 0;
    sidewalkLoops.length = 0;

    const rngCity = createRng(20261118);

    // 1. Ground plane (1600 x 1600 centered at (0, 180) at y 0, dark asphalt-green)
    const groundGeo = new THREE.PlaneGeometry(1600, 1600);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x18221b, roughness: 0.9, metalness: 0.1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 180);
    ground.receiveShadow = true;
    scene.add(ground);

    // 2. Road Network & Road Lines
    const roadX = [];
    const roadZ = [];
    for (let i = 0; i < 8; i++) {
      roadX.push(-259 + 74 * i);
      roadZ.push(-259 + 74 * i);
    }

    // Populate roadLines exports
    for (const x of roadX) {
      roadLines.push({ axis: 'z', at: x });
    }
    for (const z of roadZ) {
      roadLines.push({ axis: 'x', at: z });
    }
    // Quay road at z = 318
    roadLines.push({ axis: 'x', at: 318 });
    // Central avenue extension at x = 0 (z 259 to 340)
    roadLines.push({ axis: 'z', at: 0 });

    // isOnRoad function definition
    VB.city.isOnRoad = function(x, z) {
      // Check grid roads (16m wide -> half width 8m)
      for (const rx of roadX) {
        if (Math.abs(x - rx) <= 8 && z >= -267 && z <= 267) return true;
      }
      for (const rz of roadZ) {
        if (Math.abs(z - rz) <= 8 && x >= -267 && x <= 267) return true;
      }
      // Quay road at z = 318
      if (Math.abs(z - 318) <= 8 && x >= -267 && x <= 267) return true;
      // Central avenue extension south to quay
      if (Math.abs(x) <= 8 && z >= 259 && z <= 340) return true;
      // Quay apron
      if (x >= -267 && x <= 267 && z >= 267 && z <= 340) return true;
      return false;
    };

    // Build road strips geometry (merged)
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.8, metalness: 0.1 });
    const roadGeos = [];

    // North-South roads
    for (const rx of roadX) {
      const geom = new THREE.PlaneGeometry(16, 534);
      geom.rotateX(-Math.PI / 2);
      geom.translate(rx, 0.02, 0);
      roadGeos.push(geom);
    }
    // East-West roads
    for (const rz of roadZ) {
      const geom = new THREE.PlaneGeometry(534, 16);
      geom.rotateX(-Math.PI / 2);
      geom.translate(0, 0.02, rz);
      roadGeos.push(geom);
    }
    // Quay road
    const quayRoadGeom = new THREE.PlaneGeometry(534, 16);
    quayRoadGeom.rotateX(-Math.PI / 2);
    quayRoadGeom.translate(0, 0.02, 318);
    roadGeos.push(quayRoadGeom);

    // Central avenue extension
    const centralExtGeom = new THREE.PlaneGeometry(16, 81);
    centralExtGeom.rotateX(-Math.PI / 2);
    centralExtGeom.translate(0, 0.02, 299.5);
    roadGeos.push(centralExtGeom);

    // Merge road meshes (simple group or single mesh with merged buffer geometry if needed; let's create separate meshes or group them efficiently)
    const roadGroup = new THREE.Group();
    const fullRoadMat = roadMat;
    
    // To keep draw calls low, we can add individual planes to roadGroup or merge. Since plane count is small (~18), adding them to a group is very clean and performant.
    for (const geom of roadGeos) {
      const mesh = new THREE.Mesh(geom, fullRoadMat);
      mesh.receiveShadow = true;
      roadGroup.add(mesh);
    }
    scene.add(roadGroup);

    // Quay apron slab (z 267 to 340, x -267 to 267) at y 0.06
    const apronGeo = new THREE.PlaneGeometry(534, 73);
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x787c82, roughness: 0.8, metalness: 0.1 });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(0, 0.06, 303.5);
    apron.receiveShadow = true;
    scene.add(apron);

    // 3. Blocks, Sidewalk Frames & Buildings (7x7 grid)
    const windowTex1 = createWindowTexture('#4a525d', '#ffdb8b', '#252a33', 6, 4);
    const windowTex2 = createWindowTexture('#5d4a52', '#ffd06b', '#2a2228', 8, 5);
    const windowTex3 = createWindowTexture('#42525d', '#6be5ff', '#1e262b', 5, 3);
    const windowTex4 = createWindowTexture('#59524a', '#ff9f6b', '#2b2622', 7, 4);
    const texVariants = [windowTex1, windowTex2, windowTex3, windowTex4];

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8c8f96, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.9 });

    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const cx = -222 + 74 * i;
        const cz = -222 + 74 * j;

        // Sidewalk frame box ring (58 x 58, height 0.1, top at y 0.10)
        const sidewalkGeo = new THREE.BoxGeometry(58, 0.1, 58);
        const sidewalkMesh = new THREE.Mesh(sidewalkGeo, concreteMat);
        sidewalkMesh.position.set(cx, 0.05, cz);
        sidewalkMesh.receiveShadow = true;
        scene.add(sidewalkMesh);

        // Sidewalk loop waypoints (inset 2m inside block edge -> 58m block -> half size 29m, inset 2m = 27m from center)
        const halfBlock = 27;
        sidewalkLoops.push([
          { x: cx - halfBlock, z: cz - halfBlock },
          { x: cx + halfBlock, z: cz - halfBlock },
          { x: cx + halfBlock, z: cz + halfBlock },
          { x: cx - halfBlock, z: cz + halfBlock }
        ]);

        // Add parking spots along block edges next to sidewalks
        // North edge, South edge, East edge, West edge
        if (i % 2 === 0 && j % 2 === 0) {
          parkSpots.push({ x: cx, z: cz - 30, heading: 0 });
          parkSpots.push({ x: cx, z: cz + 30, heading: Math.PI });
        }

        // Skip some blocks for variety (hideout block near i=0,j=6; marina-facing row j=6; random)
        const isHideoutBlock = (i === 0 && j === 6);
        const isMarinaRow = (j === 6);
        const skipBlock = isHideoutBlock || isMarinaRow || (i === 3 && j === 3 && rngCity() < 0.3);

        if (skipBlock && !isHideoutBlock) {
          continue;
        }

        // Buildings per block: 1 to 4
        const buildingCount = isHideoutBlock ? 1 : (1 + Math.floor(rngCity() * 3));
        const distFromCenter = Math.sqrt(cx * cx + cz * cz);
        const maxHt = Math.max(10, 55 - distFromCenter * 0.12);
        const minHt = 8;

        for (let b = 0; b < buildingCount; b++) {
          let bWidth = 14 + rngCity() * 16;
          let bDepth = 14 + rngCity() * 16;
          let bHeight = minHt + rngCity() * (maxHt - minHt);

          let bx = cx + (b === 0 ? -10 : b === 1 ? 10 : -10) + (rngCity() - 0.5) * 6;
          let bz = cz + (b === 0 ? -10 : b === 1 ? -10 : 10) + (rngCity() - 0.5) * 6;

          if (isHideoutBlock) {
            bWidth = 24;
            bDepth = 20;
            bHeight = 12;
            bx = cx;
            bz = cz;
          }

          // Check landmarks for special styling
          let isGarage = (Math.abs(cx - 52) < 30 && Math.abs(cz - (-60)) < 30);
          let isCasino = (Math.abs(cx - 150) < 30 && Math.abs(cz - (-160)) < 30);
          let isBank = (Math.abs(cx - (-60)) < 30 && Math.abs(cz - (-190)) < 30);
          let isHotel = (Math.abs(cx - (-120)) < 30 && Math.abs(cz - 120) < 30);
          let isHospital = (Math.abs(cx - 230) < 30 && Math.abs(cz - 60) < 30);
          let isPolice = (Math.abs(cx - (-40)) < 30 && Math.abs(cz - 250) < 30);
          let isDocks = (Math.abs(cx - (-200)) < 30 && Math.abs(cz - 300) < 30);
          let isHideout = (Math.abs(cx - (-230)) < 30 && Math.abs(cz - 230) < 30);

          let texVar = texVariants[Math.floor(rngCity() * texVariants.length)];
          let bMat = new THREE.MeshStandardMaterial({ map: texVar, roughness: 0.7 });

          if (isBank) {
            bMat = new THREE.MeshStandardMaterial({ color: 0xa39b8b, roughness: 0.5 });
            bHeight = 48;
          } else if (isHotel) {
            bHeight = 52;
          } else if (isDocks) {
            bWidth = 36;
            bDepth = 28;
            bHeight = 14;
            bMat = new THREE.MeshStandardMaterial({ color: 0x8a5a44, roughness: 0.8 });
          } else if (isHideout) {
            bHeight = 10;
          }

          const bGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
          // shift geometry so base sits at y = 0.10 (sidewalk top)
          bGeo.translate(0, bHeight / 2, 0);

          const buildingMesh = new THREE.Mesh(bGeo, bMat);
          buildingMesh.position.set(bx, 0.10, bz);
          buildingMesh.castShadow = true;
          buildingMesh.receiveShadow = true;
          scene.add(buildingMesh);

          // Add distinctive neon frames / accessories for landmarks
          function addNeonFrame(by, h, color) {
            const W = bWidth + 0.4;
            const D = bDepth + 0.4;
            const t = 0.35;
            const neonMat = new THREE.MeshBasicMaterial({ color });

            const north = new THREE.Mesh(new THREE.BoxGeometry(W, h, t), neonMat);
            north.position.set(bx, by, bz - D/2 + t/2);
            scene.add(north);

            const south = new THREE.Mesh(new THREE.BoxGeometry(W, h, t), neonMat);
            south.position.set(bx, by, bz + D/2 - t/2);
            scene.add(south);

            const west = new THREE.Mesh(new THREE.BoxGeometry(t, h, D), neonMat);
            west.position.set(bx - W/2 + t/2, by, bz);
            scene.add(west);

            const east = new THREE.Mesh(new THREE.BoxGeometry(t, h, D), neonMat);
            east.position.set(bx + W/2 - t/2, by, bz);
            scene.add(east);
          }

          if (isGarage) {
            addNeonFrame(0.10 + 3.0, 0.6, VB.config.colors.neonCyan);
          } else if (isCasino) {
            addNeonFrame(0.10 + 4.0, 0.8, VB.config.colors.neonPink);
          } else if (isHotel) {
            addNeonFrame(0.10 + 12.0, 0.8, VB.config.colors.neonCyan);
          } else if (isHospital) {
            // Red cross on roof
            const crossMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
            const bar1 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 1.2), crossMat);
            const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 4), crossMat);
            bar1.position.set(bx, 0.10 + bHeight + 0.1, bz);
            bar2.position.set(bx, 0.10 + bHeight + 0.1, bz);
            scene.add(bar1);
            scene.add(bar2);
          } else if (isPolice) {
            addNeonFrame(0.10 + 5.0, 0.6, 0x3366ff);
          }

          // Register Collider
          const minX = bx - bWidth / 2;
          const maxX = bx + bWidth / 2;
          const minZ = bz - bDepth / 2;
          const maxZ = bz + bDepth / 2;
          const minY = 0.10;
          const maxY = 0.10 + bHeight;

          // If garage, make forecourt drivable by not blocking front entrance area
          if (isGarage) {
            // split into side/back colliders or leave a gap if needed, but standard box is fine
          }

          colliders.push({
            minX, maxX, minZ, maxZ, minY, maxY,
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ }
          });
        }
      }
    }

    // Ensure specific landmark park spots exist in parkSpots
    parkSpots.push({ x: 138, z: -146, heading: 1.57 }); // goldCoupeSpot
    parkSpots.push({ x: 52, z: -60, heading: 0.0 });    // garage

    VB.city.colliders = colliders;
    VB.city.roadLines = roadLines;
    VB.city.parkSpots = parkSpots;
    VB.city.sidewalkLoops = sidewalkLoops;

    // 4. Street Lamps along avenues every 37m offset to corners
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x33373d, metalness: 0.8 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2ab });

    for (const rx of roadX) {
      for (let z = -250; z <= 300; z += 37) {
        const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 4.5, 6);
        poleGeo.translate(0, 2.25, 0);
        const pole = new THREE.Mesh(poleGeo, lampMat);
        pole.position.set(rx - 8.5, 0.1, z);
        scene.add(pole);

        const bulbGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(rx - 8.5, 4.4, z);
        scene.add(bulb);
      }
    }
  }

  return {
    colliders,
    roadLines,
    parkSpots,
    sidewalkLoops,
    init
  };
})();
