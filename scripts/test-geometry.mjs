import Module from 'manifold-3d';
import { buildConnector } from '../src/geometry.js';
import { DEFAULTS, PRESETS, clampParams } from '../src/params.js';

const wasm = await Module();
wasm.setup();

const cases = [
  ['default 90', {}],
  ['acute 45', { angle: 45 }],
  ['acute 30', { angle: 30 }],
  ['obtuse 120', { angle: 120 }],
  ['obtuse 140', { angle: 140 }],
  ['thin', { thickness: 1.6, width: 10, armA: 15, armB: 15, holeCount: 1, holeDia: 2, holeMargin: 3, ribSize: 5 }],
  ['fat', { thickness: 10, width: 100, armA: 150, armB: 150, holeCount: 6, holeDia: 10, holeMargin: 25, ribSize: 60, ribCount: 4, ribThickness: 8 }],
  ['no rib', { rib: false }],
  ['no csink', { countersink: false }],
  ['slot 90', { connection: 'slot' }],
  ['slot 60', { connection: 'slot', angle: 60 }],
  ['slot 120 B', { connection: 'slot', angle: 120, orientation: 'B' }],
  ['slot deep', { connection: 'slot', thickness: 4, slotDepth: 8 }],
  ['slot wide', { connection: 'slot', slotWidth: 12 }],
  ['slot no rib', { connection: 'slot', rib: false }],
  ['3face 90', { faces: 3 }],
  ['3face slot', { faces: 3, connection: 'slot' }],
  ['3face 60 B', { faces: 3, angle: 60, orientation: 'B' }],
  ['3face short C', { faces: 3, armC: 15 }],
  ['3face no rib', { faces: 3, rib: false }],
  ['orient B 90', { orientation: 'B' }],
  ['orient B 120', { angle: 120, orientation: 'B' }],
  ['orient B 60', { angle: 60, orientation: 'B' }],
  ...PRESETS.map((preset) => [preset.id, preset.params]),
];

let failures = 0;
for (const [name, overrides] of cases) {
  const params = clampParams({ ...DEFAULTS, ...overrides });
  const result = buildConnector(wasm, params);
  const size = result.size.map((v) => v.toFixed(2)).join(' x ');
  const ok = result.status === 'NoError' && result.volume > 0 && Math.abs(result.bbox.min[2]) < 1e-4;
  if (!ok) failures++;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(10)} angle=${params.angle} orient=${params.orientation} size=${size} vol=${result.volume.toFixed(0)} tris=${result.stats.triangles} status=${result.status}`
  );
  if (result.warnings.length) console.log('     warn:', result.warnings.join(' | '));
}

console.log(failures === 0 ? '\nAll geometry cases passed.' : `\n${failures} case(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

