window.MB = window.MB || {};
(() => {
  const N = 144, CHUNK = 48, R = 110, CELL = R * Math.PI / 2 / N;
  MB.CONFIG = { N, DEFAULT_N: N, CHUNK, R, CELL, VOX: CELL, CUBE: CELL * 1.03, UNIT: .62,
    VOXEL_COUNT: 6 * N * N, WAVE_AMP: 5.2, PULSE_AMP: 4.2, JIT_AMP: .25, SEED: 20261024 };
})();
