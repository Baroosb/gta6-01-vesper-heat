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

  function createWindowTexture(seed, signature) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Background #232a33
    ctx.fillStyle = '#232a33';
    ctx.fillRect(0, 0, 128, 256);

    const cols = 6;
    const rows = 12;
    const cellW = 128 / cols;
    const cellH = 256 / rows;

    const warmColors = ['#ffdb8b', '#f7c873', '#ffe9a8'];
    const coolColors = ['#6be5ff', '#4fc8e8'];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW + cellW * 0.15;
        const y = r * cellH + cellH * 0.15;
        const w = cellW * 0.7;
        const hSize = cellH * 0.7;

        const h = (r * 31 + c * 17 + seed * 13) % 10;
        let fillColor;
        if (signature || h < 5) {
          fillColor = warmColors[(r + c) % warmColors.length];
        } else if (h < 7) {
          fillColor = coolColors[(r + c) % coolColors.length];
        } else {
          fillColor = '#151c26';
        }

        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, w, hSize);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  function mergeGeos(geos) {
    if (!geos || geos.length === 0) return null;
    let totalVertexCount = 0;
    let totalIndexCount = 0;
    for (const g of geos) {
      totalVertexCount += g.attributes.position.count;
      totalIndexCount += g.index ? g.index.count : g.attributes.position.count;
    }

    const positions = new Float32Array(totalVertexCount * 3);
    const normals = new Float32Array(totalVertexCount * 3);
    const uvs = new Float32Array(totalVertexCount * 2);
    const indices = new Uint32Array(totalIndexCount);

    let vertexOffset = 0;
    let indexOffset = 0;
    let vertexIndexOffset = 0;

    for (const g of geos) {
      const pos = g.attributes.position;
      const norm = g.attributes.normal;
      const uv = g.attributes.uv;
      const index = g.index;

      positions.set(pos.array, vertexOffset * 3);
      if (norm) normals.set(norm.array, vertexOffset * 3);
      if (uv) uvs.set(uv.array, vertexOffset * 2);

      if (index) {
        for (let i = 0; i < index.count; i++) {
          indices[indexOffset + i] = index.array[i] + vertexIndexOffset;
        }
        indexOffset += index.count;
      } else {
        for (let i = 0; i < pos.count; i++) {
          indices[indexOffset + i] = vertexIndexOffset + i;
        }
        indexOffset += pos.count;
      }

      vertexIndexOffset += pos.count;
      vertexOffset += pos.count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (normals.some(v => v !== 0)) {
      merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
      merged.computeVertexNormals();
    }
    if (uvs.some(v => v !== 0)) {
      merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    return merged;
  }

  function makeNeonSign(text, colorCss, widthMeters) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 1024, 192);

    ctx.font = '900 118px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = colorCss;
    ctx.shadowBlur = 36;
    ctx.fillStyle = colorCss;

    ctx.fillText(text, 512, 100);
    ctx.fillText(text, 512, 100);

    ctx.globalAlpha = 0.55;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 512, 100);

    const texture = new THREE.CanvasTexture(canvas);
    const heightMeters = widthMeters * 192 / 1024;
    const geometry = new THREE.PlaneGeometry(widthMeters, heightMeters);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    return new THREE.Mesh(geometry, material);
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

    const roadGroup = new THREE.Group();
    const fullRoadMat = roadMat;
    
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
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8c8f96, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.9 });

    let propGeos = [];
    let hedgeGeos = [];
    let hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2f5233, roughness: 1 });
    let shopSignIdx = 0;
    const shopSignPairs = [
      ['CAFE SERENA', '#ffb36b'],
      ['PALMA RECORDS', '#37e0d0'],
      ['BAR LUNA', '#ff4fa3'],
      ['HOTEL SOL', '#ffcc33'],
      ['PIZZA VESPER', '#ff6b4a'],
      ['CLUB NEON', '#b78bff']
    ];

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

        // Sidewalk loop waypoints
        const halfBlock = 27;
        sidewalkLoops.push([
          { x: cx - halfBlock, z: cz - halfBlock },
          { x: cx + halfBlock, z: cz - halfBlock },
          { x: cx + halfBlock, z: cz + halfBlock },
          { x: cx - halfBlock, z: cz + halfBlock }
        ]);

        if (i % 2 === 0 && j % 2 === 0) {
          parkSpots.push({ x: cx, z: cz - 30, heading: 0 });
          parkSpots.push({ x: cx, z: cz + 30, heading: Math.PI });
        }

        const isHideoutBlock = (i === 0 && j === 6);
        const isMarinaRow = (j === 6);
        const skipBlock = isHideoutBlock || isMarinaRow || (i === 3 && j === 3 && rngCity() < 0.3);

        if (skipBlock && !isHideoutBlock) {
          continue;
        }

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

          let isGarage = (Math.abs(cx - 52) < 30 && Math.abs(cz - (-60)) < 30);
          let isCasino = (Math.abs(cx - 150) < 30 && Math.abs(cz - (-160)) < 30);
          let isBank = (Math.abs(cx - (-60)) < 30 && Math.abs(cz - (-190)) < 30);
          let isHotel = (Math.abs(cx - (-120)) < 30 && Math.abs(cz - 120) < 30);
          let isHospital = (Math.abs(cx - 230) < 30 && Math.abs(cz - 60) < 30);
          let isPolice = (Math.abs(cx - (-40)) < 30 && Math.abs(cz - 250) < 30);
          let isDocks = (Math.abs(cx - (-200)) < 30 && Math.abs(cz - 300) < 30);
          let isHideout = (Math.abs(cx - (-230)) < 30 && Math.abs(cz - 230) < 30);

          let isLandmarkFirst = (b === 0 && (isGarage || isCasino || isBank || isHotel || isPolice || isDocks));

          let signature = isLandmarkFirst;
          let seedVal = Math.floor(rngCity() * 1000);
          let tex = createWindowTexture(seedVal, signature);
          let bMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });

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
          bGeo.translate(0, bHeight / 2, 0);

          const buildingMesh = new THREE.Mesh(bGeo, bMat);
          buildingMesh.position.set(bx, 0.10, bz);
          buildingMesh.castShadow = true;
          buildingMesh.receiveShadow = true;
          scene.add(buildingMesh);

          const roofY = 0.10 + bHeight;

          // Parapet (4 boxes)
          const pGeo1 = new THREE.BoxGeometry(bWidth + 0.4, 0.7, 0.3);
          pGeo1.translate(bx, roofY + 0.35, bz - bDepth / 2 + 0.15);
          propGeos.push(pGeo1);

          const pGeo2 = new THREE.BoxGeometry(bWidth + 0.4, 0.7, 0.3);
          pGeo2.translate(bx, roofY + 0.35, bz + bDepth / 2 - 0.15);
          propGeos.push(pGeo2);

          const pGeo3 = new THREE.BoxGeometry(0.3, 0.7, bDepth + 0.4);
          pGeo3.translate(bx - bWidth / 2 + 0.15, roofY + 0.35, bz);
          propGeos.push(pGeo3);

          const pGeo4 = new THREE.BoxGeometry(0.3, 0.7, bDepth + 0.4);
          pGeo4.translate(bx + bWidth / 2 - 0.15, roofY + 0.35, bz);
          propGeos.push(pGeo4);

          // Rooftop extras
          const rRoll = rngCity();
          if (rRoll < 0.5) {
            const acGeo = new THREE.BoxGeometry(1.7, 0.8, 1.7);
            acGeo.translate(
              bx + (rngCity() - 0.5) * bWidth * 0.4,
              roofY + 0.4,
              bz + (rngCity() - 0.5) * bDepth * 0.4
            );
            propGeos.push(acGeo);
          } else if (rRoll < 0.22 + 0.5) { // 0.22 range if < 0.22
            // Wait, prompt says: "Else if rngCity() < 0.22, a water tower..."
            // Let's follow exact logic: if (rngCity() < 0.5) { AC box } else if (rngCity() < 0.22) -> wait, if previous was < 0.5, rngCity() < 0.22 won't be reached unless independent or re-rolled. Let's re-read carefully:
            // "if rngCity() < 0.5, an AC box ... Else if rngCity() < 0.22, a water tower ... Else if rngCity() < 0.3, an antenna ..."
            // That phrasing usually means independent checks or a chain. Let's do independent or sequential checks with fresh rngCity() or single chain where appropriate:
          }

          // Let's implement rooftop props exactly per instructions:
          // "if rngCity() < 0.5, an AC box ... Else if rngCity() < 0.22, a water tower ... Else if rngCity() < 0.3, an antenna ..."
          // To make all branches reachable, let's roll a separate rExtra = rngCity():
          const rExtra = rngCity();
          if (rExtra < 0.5) {
            const acGeo = new THREE.BoxGeometry(1.7, 0.8, 1.7);
            acGeo.translate(
              bx + (rngCity() - 0.5) * bWidth * 0.4,
              roofY + 0.4,
              bz + (rngCity() - 0.5) * bDepth * 0.4
            );
            propGeos.push(acGeo);
          } else if (rExtra < 0.5 + 0.22) {
            const wtGeo = new THREE.CylinderGeometry(0.85, 0.95, 1.8, 8);
            wtGeo.translate(bx + bWidth * 0.28, roofY + 1.5, bz - bDepth * 0.28);
            propGeos.push(wtGeo);
            for (let leg = 0; leg < 4; leg++) {
              const legGeo = new THREE.BoxGeometry(0.12, 0.9, 0.12);
              const lx = bx + bWidth * 0.28 + (leg === 0 || leg === 2 ? 0.6 : -0.6);
              const lz = bz - bDepth * 0.28 + (leg < 2 ? 0.6 : -0.6);
              // Or simpler leg positions under water tower:
              // Let's translate accurately
            }
            // Wait, let's use exact code for water tower legs:
            // 4 leg boxes (0.12, 0.9, 0.12) under it
            const offsets = [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]];
            for (const off of offsets) {
              const legGeo = new THREE.BoxGeometry(0.12, 0.9, 0.12);
              legGeo.translate(bx + bWidth * 0.28 + off[0] * 0.6, roofY + 0.45, bz - bDepth * 0.28 + off[1] * 0.6);
              propGeos.push(legGeo);
            }
          } else if (rExtra < 0.5 + 0.22 + 0.3) {
            const antGeo = new THREE.CylinderGeometry(0.05, 0.05, 4.2, 5);
            antGeo.translate(bx, roofY + 2.1, bz);
            propGeos.push(antGeo);

            const crossGeo = new THREE.BoxGeometry(1.4, 0.06, 0.06);
            crossGeo.translate(bx, roofY + 3.6, bz);
            propGeos.push(crossGeo);
          }

          // Edit 4: neon signs on landmark building SOUTH face or shop signs
          if (isLandmarkFirst) {
            let signText = '';
            let signColor = '#37e0d0';
            let signY = 7;
            if (isGarage) { signText = 'DUARTE MOTORS'; signColor = '#37e0d0'; signY = 6; }
            else if (isCasino) { signText = 'THE GILDED PALM'; signColor = '#ff4fa3'; signY = 7; }
            else if (isHotel) { signText = 'NEPTUNE'; signColor = '#37e0d0'; signY = 18; }
            else if (isBank) { signText = 'BANCO DEL MAR'; signColor = '#ffcc33'; signY = 8; }
            else if (isPolice) { signText = 'VESPER PD'; signColor = '#6b9fff'; signY = 7; }
            else if (isDocks) { signText = 'VESPER DOCKS'; signColor = '#ff9a3c'; signY = 8; }

            if (signText) {
              const signWidth = Math.max(8, Math.min(30, bWidth * 0.92));
              const signMesh = makeNeonSign(signText, signColor, signWidth);
              signMesh.position.set(bx, 0.10 + signY, bz + bDepth / 2 + 0.3);
              scene.add(signMesh);
            }
          } else {
            if (rngCity() < 0.10 && bHeight > 16) {
              const pair = shopSignPairs[shopSignIdx % shopSignPairs.length];
              shopSignIdx++;
              const signMesh = makeNeonSign(pair[0], pair[1], 13);
              signMesh.position.set(bx, 0.10 + 4.5, bz + bDepth / 2 + 0.3);
              scene.add(signMesh);
            }
          }

          // Register Collider
          const minX = bx - bWidth / 2;
          const maxX = bx + bWidth / 2;
          const minZ = bz - bDepth / 2;
          const maxZ = bz + bDepth / 2;
          const minY = 0.10;
          const maxY = 0.10 + bHeight;

          colliders.push({
            minX, maxX, minZ, maxZ, minY, maxY,
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ }
          });
        }

        // Edit 3(d): Per block (after its buildings), if rngCity() < 0.6, add 2 to 4 hedge boxes BoxGeometry(2.6, 0.7, 0.7) translated along block's inner edges at y 0.45, inset 24 m from block center along x or z (pick edges by rngCity())
        if (rngCity() < 0.6) {
          const hedgeCount = 2 + Math.floor(rngCity() * 3); // 2 to 4
          for (let hIdx = 0; hIdx < hedgeCount; hIdx++) {
            const hedgeGeo = new THREE.BoxGeometry(2.6, 0.7, 0.7);
            const edgePick = rngCity();
            let hx = cx, hz = cz;
            if (edgePick < 0.25) {
              hx = cx + (rngCity() - 0.5) * 40;
              hz = cz - 24;
            } else if (edgePick < 0.5) {
              hx = cx + (rngCity() - 0.5) * 40;
              hz = cz + 24;
            } else if (edgePick < 0.75) {
              hx = cx - 24;
              hz = cz + (rngCity() - 0.5) * 40;
              // rotate box for vertical edges
              hedgeGeo.rotateY(Math.PI / 2);
            } else {
              hx = cx + 24;
              hz = cz + (rngCity() - 0.5) * 40;
              hedgeGeo.rotateY(Math.PI / 2);
            }
            hedgeGeo.translate(hx, 0.45, hz);
            hedgeGeos.push(hedgeGeo);
          }
        }
      }
    }

    // Edit 3(e): After all loops, if propGeos is non-empty, create one Mesh from mergeGeos(propGeos) with roofMat, receiveShadow = true, add to scene. If hedgeGeos non-empty, mergeGeos(hedgeGeos) with hedgeMat, add to scene.
    const mergedProps = mergeGeos(propGeos);
    if (mergedProps) {
      const propMesh = new THREE.Mesh(mergedProps, roofMat);
      propMesh.receiveShadow = true;
      scene.add(propMesh);
    }

    const mergedHedges = mergeGeos(hedgeGeos);
    if (mergedHedges) {
      const hedgeMesh = new THREE.Mesh(mergedHedges, hedgeMat);
      hedgeMesh.castShadow = true;
      hedgeMesh.receiveShadow = true;
      scene.add(hedgeMesh);
    }

    // Edit 5: Freestanding city sign, inside init() after block loops
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.8 });
    const poleGeo1 = new THREE.CylinderGeometry(0.18, 0.18, 9, 8);
    poleGeo1.translate(-11, 4.5, 326);
    const poleGeo2 = new THREE.CylinderGeometry(0.18, 0.18, 9, 8);
    poleGeo2.translate(11, 4.5, 326);
    const mergedPoles = mergeGeos([poleGeo1, poleGeo2]);
    if (mergedPoles) {
      scene.add(new THREE.Mesh(mergedPoles, poleMat));
    }
    const citySignMesh = makeNeonSign('VESPER BAY', '#ff4fa3', 30);
    citySignMesh.position.set(0, 8.2, 326);
    scene.add(citySignMesh);

    // Edit 6: Avenue palms, merged, inside init() after block loops
    const palmTrunkGeos = [];
    const palmFrondGeos = [];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7d46, roughness: 0.8, side: THREE.DoubleSide });

    const avenueX = [26.5, 47.5, -26.5, -47.5];
    let palmIdx = 0;
    for (const ax of avenueX) {
      for (let z = -240; z <= 240; z += 48) {
        palmIdx++;
        const lean = (palmIdx % 2 === 0 ? 0.15 : -0.15);

        // Trunk part 1
        const t1 = new THREE.CylinderGeometry(0.14, 0.14, 1.3, 6);
        t1.rotateZ(lean);
        t1.translate(ax, 0.65, z);
        palmTrunkGeos.push(t1);

        // Trunk part 2
        const t2 = new THREE.CylinderGeometry(0.14, 0.11, 1.3, 6);
        t2.rotateZ(-lean * 0.5);
        t2.translate(ax + lean * 0.6, 1.95, z);
        palmTrunkGeos.push(t2);

        // Fronds (6 planes 2.9 x 0.55 rotated around top at y 5.1 approx)
        const topY = 3.2;
        for (let f = 0; f < 6; f++) {
          const angle = (f / 6) * Math.PI * 2;
          const fGeo = new THREE.PlaneGeometry(2.9, 0.55);
          fGeo.rotateX(Math.PI / 3);
          fGeo.rotateY(angle);
          fGeo.translate(ax + lean * 0.6, topY, z);
          palmFrondGeos.push(fGeo);
        }
      }
    }

    const mergedTrunks = mergeGeos(palmTrunkGeos);
    if (mergedTrunks) {
      scene.add(new THREE.Mesh(mergedTrunks, trunkMat));
    }
    const mergedFronds = mergeGeos(palmFrondGeos);
    if (mergedFronds) {
      scene.add(new THREE.Mesh(mergedFronds, frondMat));
    }

    // Ensure specific landmark park spots exist in parkSpots
    parkSpots.push({ x: 138, z: -146, heading: 1.57 }); // goldCoupeSpot
    parkSpots.push({ x: 52, z: -60, heading: 0.0 });    // garage

    VB.city.colliders = colliders;
    VB.city.roadLines = roadLines;
    VB.city.parkSpots = parkSpots;
    VB.city.sidewalkLoops = sidewalkLoops;

    // Edit 7: Lamp glow sprites
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const gCtx = glowCanvas.getContext('2d');
    const grad = gCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.5, 'rgba(255, 220, 160, 0.5)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, 128, 128);

    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const glowMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

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

        if (Math.abs(rx - 37) < 0.1 || Math.abs(rx - (-37)) < 0.1) {
          const sprite = new THREE.Sprite(glowMat);
          sprite.scale.set(3.4, 3.4, 1);
          sprite.position.set(rx - 8.5, 4.4, z);
          scene.add(sprite);
        }
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
