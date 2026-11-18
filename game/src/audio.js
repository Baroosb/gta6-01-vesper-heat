window.VB = window.VB || {};

(function() {
  let ctx = null;
  let noiseBuffer = null;
  let padGain = null;
  let padOsc1 = null;
  let padOsc2 = null;
  let padFilter = null;
  let isPadActive = false;

  let engineOsc = null;
  let engineFilter = null;
  let engineGain = null;
  let engineRunning = false;

  let sirenOsc = null;
  let sirenGain = null;
  let sirenInterval = null;
  let sirenRunning = false;

  function createNoiseBuffer(audioCtx) {
    if (noiseBuffer) return noiseBuffer;
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / audioCtx.sampleRate;
      const val = Math.sin(t * 12345.6789 + Math.sin(t * 987.65) * 43.21);
      data[i] = val * 2 - 1;
    }
    noiseBuffer = buffer;
    return buffer;
  }

  VB.audio = {
    init: function() {
      if (ctx) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        ctx = new AudioContext();
        createNoiseBuffer(ctx);
      } catch (e) {
        ctx = null;
      }
    },

    setPad: function(on) {
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      if (on && !isPadActive) {
        isPadActive = true;
        try {
          padGain = ctx.createGain();
          padGain.gain.setValueAtTime(0.001, ctx.currentTime);
          padGain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2);

          padFilter = ctx.createBiquadFilter();
          padFilter.type = 'lowpass';
          padFilter.frequency.setValueAtTime(300, ctx.currentTime);

          padOsc1 = ctx.createOscillator();
          padOsc1.type = 'triangle';
          padOsc1.frequency.setValueAtTime(110, ctx.currentTime);

          padOsc2 = ctx.createOscillator();
          padOsc2.type = 'triangle';
          padOsc2.frequency.setValueAtTime(164.81, ctx.currentTime);

          padOsc1.connect(padFilter);
          padOsc2.connect(padFilter);
          padFilter.connect(padGain);
          padGain.connect(ctx.destination);

          padOsc1.start();
          padOsc2.start();
        } catch (e) {}
      } else if (!on && isPadActive) {
        isPadActive = false;
        try {
          if (padGain) {
            padGain.gain.setValueAtTime(padGain.gain.value, ctx.currentTime);
            padGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
            setTimeout(() => {
              if (!isPadActive) {
                if (padOsc1) { padOsc1.stop(); padOsc1.disconnect(); padOsc1 = null; }
                if (padOsc2) { padOsc2.stop(); padOsc2.disconnect(); padOsc2 = null; }
                if (padFilter) { padFilter.disconnect(); padFilter = null; }
                if (padGain) { padGain.disconnect(); padGain = null; }
              }
            }, 1600);
          }
        } catch (e) {}
      }
    },

    engineStart: function() {
      if (!ctx || engineRunning) return;
      try {
        engineRunning = true;
        engineGain = ctx.createGain();
        engineGain.gain.setValueAtTime(0.03, ctx.currentTime);

        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.setValueAtTime(200, ctx.currentTime);

        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.setValueAtTime(60, ctx.currentTime);

        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(ctx.destination);
        engineOsc.start();
      } catch (e) {
        engineRunning = false;
      }
    },

    engineSet: function(speed01) {
      if (!ctx || !engineRunning || !engineOsc || !engineFilter) return;
      try {
        const freq = 50 + speed01 * 180;
        const cutoff = 150 + speed01 * 800;
        engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.1);
        engineFilter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.1);
      } catch (e) {}
    },

    engineStop: function() {
      if (!ctx || !engineRunning) return;
      engineRunning = false;
      try {
        if (engineOsc) { engineOsc.stop(); engineOsc.disconnect(); engineOsc = null; }
        if (engineFilter) { engineFilter.disconnect(); engineFilter = null; }
        if (engineGain) { engineGain.disconnect(); engineGain = null; }
      } catch (e) {}
    },

    sirenStart: function() {
      if (!ctx || sirenRunning) return;
      sirenRunning = true;
      try {
        sirenGain = ctx.createGain();
        sirenGain.gain.setValueAtTime(0.04, ctx.currentTime);

        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'square';
        sirenOsc.frequency.setValueAtTime(660, ctx.currentTime);
        sirenOsc.connect(sirenGain);
        sirenGain.connect(ctx.destination);
        sirenOsc.start();

        let high = false;
        sirenInterval = setInterval(() => {
          if (!sirenRunning || !ctx || !sirenOsc) return;
          high = !high;
          sirenOsc.frequency.setValueAtTime(high ? 880 : 660, ctx.currentTime);
        }, 250);
      } catch (e) {
        sirenRunning = false;
      }
    },

    sirenStop: function() {
      if (!sirenRunning) return;
      sirenRunning = false;
      if (sirenInterval) {
        clearInterval(sirenInterval);
        sirenInterval = null;
      }
      try {
        if (sirenOsc) { sirenOsc.stop(); sirenOsc.disconnect(); sirenOsc = null; }
        if (sirenGain) { sirenGain.disconnect(); sirenGain = null; }
      } catch (e) {}
    },

    gunshot: function() {
      if (!ctx) return;
      try {
        const source = ctx.createBufferSource();
        source.buffer = createNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start();
        source.stop(ctx.currentTime + 0.16);
      } catch (e) {}
    },

    hit: function() {
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.1);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.11);
      } catch (e) {}
    },

    crash: function(impact) {
      if (!ctx) return;
      try {
        const vol = Math.min(Math.max(impact || 0.5, 0.1), 1.0) * 0.3;
        const source = ctx.createBufferSource();
        source.buffer = createNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start();
        source.stop(ctx.currentTime + 0.45);
      } catch (e) {}
    },

    cash: function() {
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } catch (e) {}
    },

    success: function() {
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const notes = [440, 554.37, 659.25];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.15, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.25);
        });
      } catch (e) {}
    },

    door: function() {
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
      } catch (e) {}
    },

    step: function() {
      if (!ctx) return;
      try {
        const source = ctx.createBufferSource();
        source.buffer = createNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start();
        source.stop(ctx.currentTime + 0.05);
      } catch (e) {}
    }
  };
})();
