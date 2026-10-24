// A memory landscape, not geographical coordinates. Shared by terrain and buildings.
window.MB_SCENE = {
  id: 'the-way-home', title: '还住在这里 · 音乐星球', seed: 20261024, duration: 64,
  // Deliberately uneven: a northern harbour, a middle-latitude street and a southern campus.
  districts: [
    { id: 'garden', name: '散步的花园', lat: .65, lon: .98, r: .21, flat: .5, react: .65 },
    { id: 'hongkong', name: '香港 · 海风里的高楼', lat: .95, lon: -.85, r: .235, flat: 1, react: .06, urban: true },
    { id: 'turin', name: '都灵 · 红瓦下的街巷', lat: .33, lon: .03, r: .235, flat: 1, react: .06, urban: true },
    { id: 'shanghai', name: '上海 · 松江的校园', lat: -.40, lon: 1.14, r: .235, flat: 1, react: .06, urban: true },
    { id: 'harbour', name: '海风', lat: -0.1861, lon: -0.8370, r: .22, flat: 1, react: .16, water: .19 },
    { id: 'meadow', name: '阳光草甸', lat: -0.1012, lon: 0.5004, r: .26, flat: .5, react: .65 },
    { id: 'birches', name: '白桦林', lat: -0.4096, lon: 1.7525, r: .24, flat: .5, react: .65 },
    { id: 'orchard', name: '回忆的果园', lat: -0.6368, lon: -1.6737, r: .25, flat: .6, react: .6 },
    { id: 'pines', name: '远方松林', lat: 0.5350, lon: 2.1468, r: .26, flat: .4, react: .6 },
    { id: 'lake', name: '安静的湖', lat: 0.4026, lon: -2.1255, r: .23, flat: .9, react: .16, water: .18 },
    { id: 'fields', name: '金色田野', lat: -0.6875, lon: -2.9089, r: .27, flat: .8, react: .4 },
    { id: 'hill', name: '远处的山坡', lat: -0.8047, lon: 2.6034, r: .25, flat: .3, react: .6 },
    { id: 'north', name: '白云下面', lat: 1.4491, lon: 2.3538, r: .20, flat: .5, react: .4 },
    { id: 'south', name: '一路繁花', lat: -1.4458, lon: 0.3735, r: .20, flat: .5, react: .6 },
    { id: 'back', name: '路的另一边', lat: 0.4706, lon: 3.0441, r: .22, flat: .6, react: .5 }
  ],
  rings: [{ id: 'way', name: '回去的路', pole: [.68314, .72357, .09883], half: .024, react: .02 }],
  waveSources: ['hongkong', 'meadow'],
  audioBindings: { bass: '连续地表起伏', beat: '阿绵交替迈步与柔和脉冲', mid: '波纹细节', progress: '行走位置、抵达城市、天色' },
  // These are authored travel chapters for the synthetic demo, not inferred song sections.
  chapters: [
    { id: 'leave', name: '出发 · 海风', at: 0, blend: 5, state: { skyHor: [.91,.96,.97], hazeCol: [.87,.94,.95], sunCol: [1.12,1.04,.9], ambCol: [.53,.61,.64], sunElev: .8, haze: .02, wet: 0, frost: 0, ice: 0, lights: 0 } },
    { id: 'street', name: '午后 · 街巷', at: 22, blend: 8, state: { skyHor: [.98,.94,.85], hazeCol: [.98,.94,.87], sunCol: [1.15,.94,.74], ambCol: [.58,.58,.57], sunElev: .62, haze: .03, wet: 0, frost: 0, ice: 0, lights: .12 } },
    { id: 'campus', name: '傍晚 · 校园', at: 42, blend: 8, state: { skyHor: [.96,.85,.78], hazeCol: [.96,.87,.82], sunCol: [1.03,.76,.63], ambCol: [.54,.55,.63], sunElev: .38, haze: .06, wet: 0, frost: 0, ice: 0, lights: .65 } },
    { id: 'home', name: '灯亮了', at: 56, blend: 8, state: { skyHor: [.81,.85,.93], hazeCol: [.83,.86,.94], sunCol: [.82,.79,.97], ambCol: [.51,.54,.66], sunElev: .27, haze: .08, wet: 0, frost: 0, ice: 0, lights: 1 } }
  ]
};
