window.VB = window.VB || {};

window.VB.hud = (function() {
  let hudRoot = null;
  let screensRoot = null;
  let minimapCanvas = null;
  let minimapCtx = null;

  let cashEl = null;
  let debtEl = null;
  let starsEl = null;
  let vehicleEl = null;
  let healthFillEl = null;
  let bustContainerEl = null;
  let bustFillEl = null;
  let objectiveEl = null;
  let timerEl = null;
  let dialogContainerEl = null;
  let dialogLinesEl = null;
  let dialogHintEl = null;
  let toastContainerEl = null;
  let bannerEl = null;
  let bannerTitleEl = null;
  let bannerSubEl = null;

  let screenTitleEl = null;
  let screenPausedEl = null;
  let screenBustedEl = null;
  let screenWastedEl = null;
  let screenCompleteEl = null;

  let bannerTimer = 0;

  function init() {
    hudRoot = document.getElementById('hud');
    screensRoot = document.getElementById('screens');
    minimapCanvas = document.getElementById('minimap');
    if (minimapCanvas) {
      minimapCtx = minimapCanvas.getContext('2d');
    }

    if (!hudRoot || !screensRoot) return;

    hudRoot.innerHTML = `
      <div id="vb-cash-panel" style="position: fixed; top: 16px; left: 16px; background: rgba(20,16,26,0.85); border: 1px solid rgba(255,154,60,0.3); border-radius: 8px; padding: 10px 14px; color: #fff; font-size: 14px; z-index: 10; pointer-events: none;">
        <div id="vb-cash" style="color: #37e0d0; font-size: 18px; font-weight: 800; text-shadow: 0 0 8px rgba(55,224,208,0.4);">$0</div>
        <div id="vb-debt" style="color: #ff9a3c; font-size: 12px; margin-top: 2px;">DEBT $25000</div>
      </div>

      <div id="vb-wanted-panel" style="position: fixed; top: 16px; right: 220px; background: rgba(20,16,26,0.85); border: 1px solid rgba(255,79,163,0.3); border-radius: 8px; padding: 10px 14px; color: #fff; text-align: right; z-index: 10; pointer-events: none;">
        <div id="vb-stars" style="font-size: 18px; letter-spacing: 2px; color: #ffaa00; text-shadow: 0 0 8px rgba(255,170,0,0.5);">☆☆☆☆☆</div>
        <div id="vb-vehicle" style="color: #aaa; font-size: 12px; margin-top: 2px;"></div>
      </div>

      <div id="vb-status-panel" style="position: fixed; bottom: 20px; left: 20px; background: rgba(20,16,26,0.85); border: 1px solid rgba(55,224,208,0.3); border-radius: 8px; padding: 12px; width: 180px; z-index: 10; pointer-events: none;">
        <div style="font-size: 11px; color: #aaa; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px;">Health</div>
        <div style="width: 180px; height: 10px; background: #2a2235; border-radius: 5px; overflow: hidden;">
          <div id="vb-health-fill" style="width: 100%; height: 100%; background: linear-gradient(90deg, #37e0d0, #22bb99); transition: width 0.15s;"></div>
        </div>
        <div id="vb-bust-container" style="margin-top: 8px; display: none;">
          <div style="font-size: 11px; color: #ff4fa3; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px;">Bust Meter</div>
          <div style="width: 180px; height: 8px; background: #2a2235; border-radius: 4px; overflow: hidden;">
            <div id="vb-bust-fill" style="width: 0%; height: 100%; background: #ff4fa3;"></div>
          </div>
        </div>
      </div>

      <div id="vb-objective-panel" style="position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: rgba(20,16,26,0.85); border: 1px solid rgba(55,224,208,0.4); border-radius: 8px; padding: 10px 20px; text-align: center; z-index: 10; pointer-events: none; max-width: 450px;">
        <div id="vb-objective" style="color: #fff; font-size: 14px; font-weight: 700;">Objective</div>
        <div id="vb-timer" style="color: #37e0d0; font-size: 16px; font-weight: 800; margin-top: 4px; display: none;">00:00</div>
      </div>

      <div id="vb-dialog-panel" style="position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: rgba(20,16,26,0.92); border: 2px solid rgba(255,79,163,0.5); border-radius: 12px; padding: 16px 24px; text-align: center; z-index: 10; pointer-events: none; max-width: 520px; display: none; box-shadow: 0 0 20px rgba(255,79,163,0.3);">
        <div id="vb-dialog-lines" style="color: #fff; font-size: 15px; font-style: italic; line-height: 1.4;"></div>
        <div id="vb-dialog-hint" style="color: #37e0d0; font-size: 12px; font-weight: 700; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px;"></div>
      </div>

      <div id="vb-toast-stack" style="position: fixed; top: 90px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 15; pointer-events: none;"></div>

      <div id="vb-banner" style="position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: 25; pointer-events: none; opacity: 0; transition: opacity 0.5s;">
        <div id="vb-banner-title" style="color: #ff4fa3; font-size: 48px; font-weight: 900; text-shadow: 0 0 25px rgba(255,79,163,0.8); letter-spacing: 2px;"></div>
        <div id="vb-banner-sub" style="color: #37e0d0; font-size: 18px; font-weight: 700; margin-top: 8px; text-shadow: 0 0 15px rgba(55,224,208,0.6);"></div>
      </div>
    `;

    cashEl = document.getElementById('vb-cash');
    debtEl = document.getElementById('vb-debt');
    starsEl = document.getElementById('vb-stars');
    vehicleEl = document.getElementById('vb-vehicle');
    healthFillEl = document.getElementById('vb-health-fill');
    bustContainerEl = document.getElementById('vb-bust-container');
    bustFillEl = document.getElementById('vb-bust-fill');
    objectiveEl = document.getElementById('vb-objective');
    timerEl = document.getElementById('vb-timer');
    dialogContainerEl = document.getElementById('vb-dialog-panel');
    dialogLinesEl = document.getElementById('vb-dialog-lines');
    dialogHintEl = document.getElementById('vb-dialog-hint');
    toastContainerEl = document.getElementById('vb-toast-stack');
    bannerEl = document.getElementById('vb-banner');
    bannerTitleEl = document.getElementById('vb-banner-title');
    bannerSubEl = document.getElementById('vb-banner-sub');

    screensRoot.innerHTML = `
      <div id="screen-title" style="position: fixed; inset: 0; background: radial-gradient(circle at center, #2e243f 0%, #120e18 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 30; padding: 20px; text-align: center; color: #fff;">
        <h1 style="font-size: 64px; font-weight: 900; color: #ff4fa3; text-shadow: 0 0 30px rgba(255,79,163,0.7); margin: 0 0 8px 0; letter-spacing: 3px;">VESPER HEAT</h1>
        <div style="font-size: 18px; color: #37e0d0; font-weight: 700; margin-bottom: 24px; text-shadow: 0 0 15px rgba(55,224,208,0.5);">Vesper Bay — golden hour, neon nights</div>
        <p style="max-width: 550px; font-size: 14px; line-height: 1.5; color: #ddd; margin: 0 auto 24px auto;">Wheelman Rafa Mendes owes loan shark Vic Serrano $25,000. Fixer Sel Duarte has five jobs that pay it off before the bay burns down.</p>
        <div style="background: rgba(20,16,26,0.6); border: 1px solid rgba(255,154,60,0.3); border-radius: 8px; padding: 12px 20px; font-size: 12px; color: #ff9a3c; margin-bottom: 30px; max-width: 600px; line-height: 1.4;">
          <strong>Controls:</strong> WASD move / mouse look / F enter-exit car / E talk-accept / Left Mouse fire / Shift run / Space handbrake / P pause
        </div>
        <div style="font-size: 20px; font-weight: 800; color: #37e0d0; animation: pulse 1.5s infinite; text-shadow: 0 0 10px rgba(55,224,208,0.8);">Click to play</div>
      </div>

      <div id="screen-paused" style="position: fixed; inset: 0; background: rgba(18, 14, 24, 0.85); backdrop-filter: blur(5px); display: none; flex-direction: column; align-items: center; justify-content: center; z-index: 30; color: #fff; text-align: center;">
        <h2 style="font-size: 42px; font-weight: 900; color: #ff9a3c; text-shadow: 0 0 20px rgba(255,154,60,0.6); margin-bottom: 12px;">PAUSED</h2>
        <div style="font-size: 18px; color: #37e0d0; font-weight: 700;">Press P to resume</div>
      </div>

      <div id="screen-busted" style="position: fixed; inset: 0; background: rgba(18, 14, 24, 0.9); display: none; flex-direction: column; align-items: center; justify-content: center; z-index: 30; color: #fff; text-align: center;">
        <h2 style="font-size: 56px; font-weight: 900; color: #ff4fa3; text-shadow: 0 0 25px rgba(255,79,163,0.8); margin-bottom: 8px;">BUSTED</h2>
        <p style="font-size: 16px; color: #ddd; margin-bottom: 20px;">The police take 10% of your cash.</p>
        <div style="font-size: 18px; color: #37e0d0; font-weight: 700;">Press R to continue</div>
      </div>

      <div id="screen-wasted" style="position: fixed; inset: 0; background: rgba(20, 10, 15, 0.92); display: none; flex-direction: column; align-items: center; justify-content: center; z-index: 30; color: #fff; text-align: center;">
        <h2 style="font-size: 64px; font-weight: 900; color: #cc2222; text-shadow: 0 0 30px rgba(204,34,34,0.8); margin-bottom: 12px;">WASTED</h2>
        <div style="font-size: 18px; color: #37e0d0; font-weight: 700;">Press R to wake up at the hospital</div>
      </div>

      <div id="screen-complete" style="position: fixed; inset: 0; background: rgba(14, 22, 28, 0.92); display: none; flex-direction: column; align-items: center; justify-content: center; z-index: 30; color: #fff; text-align: center; padding: 20px;">
        <h2 style="font-size: 56px; font-weight: 900; color: #37e0d0; text-shadow: 0 0 30px rgba(55,224,208,0.8); margin-bottom: 8px;">DEBT CLEARED</h2>
        <p style="font-size: 16px; color: #ddd; max-width: 450px; margin-bottom: 24px; line-height: 1.5;">Vesper Bay is yours now, Rafa. Side jobs at Sel pay $300.</p>
        <div style="font-size: 18px; color: #ff9a3c; font-weight: 700;">Press R to keep roaming</div>
      </div>
    `;

    screenTitleEl = document.getElementById('screen-title');
    screenPausedEl = document.getElementById('screen-paused');
    screenBustedEl = document.getElementById('screen-busted');
    screenWastedEl = document.getElementById('screen-wasted');
    screenCompleteEl = document.getElementById('screen-complete');

    if (screenTitleEl) {
      screenTitleEl.addEventListener('click', () => {
        if (VB.world && typeof VB.world.setState === 'function') {
          VB.world.setState('playing');
        }
      });
    }

    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && VB.world && VB.world.state === 'playing' && !VB.world.shotMode) {
        VB.world.setState('paused');
      }
    });
  }

  function toast(text) {
    if (!toastContainerEl) return;
    const el = document.createElement('div');
    el.style.background = 'rgba(20,16,26,0.9)';
    el.style.border = '1px solid rgba(55,224,208,0.5)';
    el.style.borderRadius = '6px';
    el.style.padding = '8px 16px';
    el.style.color = '#fff';
    el.style.fontSize = '13px';
    el.style.fontWeight = '700';
    el.style.boxShadow = '0 0 10px rgba(55,224,208,0.3)';
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s, transform 0.3s';
    el.style.transform = 'translateY(-10px)';
    el.textContent = text;

    toastContainerEl.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }, 3500);
  }

  function banner(title, sub) {
    if (!bannerEl || !bannerTitleEl || !bannerSubEl) return;
    bannerTitleEl.textContent = title;
    bannerSubEl.textContent = sub || '';
    bannerEl.style.opacity = '1';
    bannerTimer = 3.0;
  }

  function refresh() {
    update(0);
  }

  function update(dt) {
    if (!VB.world) return;

    if (VB.input && typeof VB.input.pressed === 'function') {
      if (VB.input.pressed('KeyP')) {
        if (VB.world.state === 'playing') {
          VB.world.setState('paused');
        } else if (VB.world.state === 'paused') {
          VB.world.setState('playing');
        }
      }
      if (VB.input.pressed('KeyR')) {
        if (VB.world.state === 'busted') {
          if (VB.missions && typeof VB.missions.restart === 'function') {
            VB.missions.restart('busted');
          }
        } else if (VB.world.state === 'wasted') {
          if (VB.missions && typeof VB.missions.restart === 'function') {
            VB.missions.restart('wasted');
          }
        } else if (VB.world.state === 'complete') {
          VB.world.setState('playing');
        }
      }
    }

    const state = VB.world.state;
    const shotMode = VB.world.shotMode;

    if (screenTitleEl) screenTitleEl.style.display = (!shotMode && state === 'title') ? 'flex' : 'none';
    if (screenPausedEl) screenPausedEl.style.display = (!shotMode && state === 'paused') ? 'flex' : 'none';
    if (screenBustedEl) screenBustedEl.style.display = (!shotMode && state === 'busted') ? 'flex' : 'none';
    if (screenWastedEl) screenWastedEl.style.display = (!shotMode && state === 'wasted') ? 'flex' : 'none';
    if (screenCompleteEl) screenCompleteEl.style.display = (!shotMode && state === 'complete') ? 'flex' : 'none';



    if (bannerTimer > 0 && bannerEl) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) {
        bannerEl.style.opacity = '0';
      }
    }

    if (cashEl) cashEl.textContent = '$' + (VB.world.cash || 0);
    if (debtEl) {
      const debtTotal = VB.config && VB.config.debtTotal ? VB.config.debtTotal : 25000;
      const remainingDebt = Math.max(0, debtTotal - (VB.world.cash || 0));
      debtEl.textContent = 'DEBT $' + remainingDebt;
    }

    const stars = (VB.police && typeof VB.police.stars === 'number') ? VB.police.stars : 0;
    if (starsEl) {
      let starStr = '';
      for (let i = 0; i < 5; i++) {
        starStr += i < stars ? '★' : '☆';
      }
      starsEl.textContent = starStr;
    }

    if (vehicleEl && VB.player) {
      if (VB.player.isDriving() && VB.player.car) {
        const c = VB.player.car;
        const speedKmh = Math.round(Math.abs(c.speed || 0) * 3.6);
        const kind = (c.kind || 'car').toUpperCase();
        vehicleEl.textContent = `${kind} · ${speedKmh} km/h`;
      } else {
        vehicleEl.textContent = '';
      }
    }

    if (healthFillEl && VB.player) {
      const hp = Math.max(0, Math.min(100, VB.player.health !== undefined ? VB.player.health : 100));
      healthFillEl.style.width = hp + '%';
      if (hp > 50) {
        healthFillEl.style.background = 'linear-gradient(90deg, #37e0d0, #22bb99)';
      } else if (hp > 25) {
        healthFillEl.style.background = 'linear-gradient(90deg, #ff9a3c, #f39c12)';
      } else {
        healthFillEl.style.background = 'linear-gradient(90deg, #ff4fa3, #cc2222)';
      }
    }

    if (bustContainerEl && bustFillEl && VB.police) {
      const bp = VB.police.bustProgress || 0;
      const bustSeconds = VB.config && VB.config.bustSeconds ? VB.config.bustSeconds : 2.5;
      if (bp > 0) {
        bustContainerEl.style.display = 'block';
        const pct = Math.min(100, (bp / bustSeconds) * 100);
        bustFillEl.style.width = pct + '%';
      } else {
        bustContainerEl.style.display = 'none';
      }
    }

    if (VB.missions) {
      if (objectiveEl) {
        objectiveEl.textContent = VB.missions.objective || '';
      }
      if (timerEl) {
        const t = VB.missions.timer;
        if (t !== null && t !== undefined) {
          timerEl.style.display = 'block';
          const mins = Math.floor(t / 60);
          const secs = Math.floor(t % 60);
          timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          if (t < 30) {
            timerEl.style.color = '#ff3333';
          } else {
            timerEl.style.color = '#37e0d0';
          }
        } else {
          timerEl.style.display = 'none';
        }
      }

      if (dialogContainerEl && dialogLinesEl && dialogHintEl) {
        const dlg = VB.missions.dialog;
        if (dlg && dlg.lines) {
          dialogContainerEl.style.display = 'block';
          dialogLinesEl.innerHTML = dlg.lines.map(l => `<p style="margin: 0 0 6px 0;">${l}</p>`).join('');
          dialogHintEl.textContent = dlg.hint || '';
        } else {
          dialogContainerEl.style.display = 'none';
        }
      }
    }

    renderMinimap();
  }

  function renderMinimap() {
    if (!minimapCtx || !minimapCanvas) return;
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const ctx = minimapCtx;

    ctx.clearRect(0, 0, w, h);

    const scale = w / 600;
    const cx = w / 2;
    const cy = h / 2;

    ctx.fillStyle = '#14586b';
    ctx.fillRect(0, 0, w, h);

    const landX1 = cx + (-267) * scale;
    const landZ1 = cy + (-267) * scale;
    const landSize = 534 * scale;
    ctx.fillStyle = '#1c2029';
    ctx.fillRect(landX1, landZ1, landSize, landSize);

    const quayZ1 = cy + 267 * scale;
    const quayZ2 = cy + 300 * scale;
    ctx.fillStyle = '#262c3a';
    ctx.fillRect(landX1, quayZ1, landSize, quayZ2 - quayZ1);

    if (VB.city && VB.city.roadLines && Array.isArray(VB.city.roadLines)) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#555f70';
      for (const line of VB.city.roadLines) {
        if (line.axis === 'z') {
          const rx = cx + line.at * scale;
          const rz1 = cy + (-267) * scale;
          const rz2 = cy + 267 * scale;
          ctx.beginPath();
          ctx.moveTo(rx, rz1);
          ctx.lineTo(rx, rz2);
          ctx.stroke();
        } else if (line.axis === 'x') {
          const rzVal = Math.min(300, Math.max(-267, line.at));
          const ry = cy + rzVal * scale;
          const rx1 = cx + (-267) * scale;
          const rx2 = cx + 267 * scale;
          ctx.beginPath();
          ctx.moveTo(rx1, ry);
          ctx.lineTo(rx2, ry);
          ctx.stroke();
        }
      }
    }

    const pCar = VB.player && VB.player.car ? VB.player.car : null;
    if (VB.cars && VB.cars.all && Array.isArray(VB.cars.all)) {
      for (const car of VB.cars.all) {
        if (car === pCar) continue;
        const carX = car.x !== undefined ? car.x : 0;
        const carZ = car.z !== undefined ? car.z : 0;
        const blipX = cx + carX * scale;
        const blipY = cy + carZ * scale;

        if (blipX < 0 || blipX > w || blipY < 0 || blipY > h) continue;

        if (car.isPolice) {
          const alt = Math.floor((VB.world ? VB.world.time : 0) * 4) % 2 === 0;
          ctx.fillStyle = alt ? '#37e0d0' : '#ff4fa3';
          ctx.beginPath();
          ctx.arc(blipX, blipY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#888888';
          ctx.beginPath();
          ctx.arc(blipX, blipY, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (VB.missions && VB.missions.targetPos) {
      const tp = VB.missions.targetPos;
      const tpx = cx + tp.x * scale;
      const tpy = cy + tp.z * scale;
      const pulseRadius = 3 + Math.sin((VB.world ? VB.world.time : 0) * 6) * 1.5;
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.arc(tpx, tpy, pulseRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (VB.player) {
      const isDrv = VB.player.isDriving() && VB.player.car;
      const px = isDrv ? VB.player.car.x : VB.player.x;
      const pz = isDrv ? VB.player.car.z : VB.player.z;
      const pHead = isDrv ? VB.player.car.heading : VB.player.heading;

      const mX = cx + (px !== undefined ? px : 0) * scale;
      const mY = cy + (pz !== undefined ? pz : 0) * scale;

      ctx.save();
      ctx.translate(mX, mY);
      ctx.rotate(pHead !== undefined ? pHead : 0);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(3.5, 4);
      ctx.lineTo(-3.5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  return {
    init,
    update,
    toast,
    banner,
    refresh
  };
})();
