const HOLE_SEGMENTS = 64;

function positionsAlong(start, end, count) {
  const n = Math.max(1, Math.round(count));
  if (n === 1) return [(start + end) / 2];
  const out = [];
  for (let i = 0; i < n; i++) out.push(start + ((end - start) * i) / (n - 1));
  return out;
}

function layoutHoles(start, end, requested, minGap, label, warnings) {
  const span = end - start;
  if (span < minGap) {
    warnings.push(`${label}的可用空间不足，无法布置连接孔`);
    return [];
  }
  const maxCount = Math.floor(span / minGap) + 1;
  const count = Math.min(Math.max(1, Math.round(requested)), maxCount);
  if (count < requested) {
    warnings.push(`${label}孔位间距不足，连接数量已自动减少至 ${count}`);
  }
  return positionsAlong(start, end, count);
}

export function buildConnector(wasm, p) {
  const { Manifold, CrossSection } = wasm;
  const rad = (p.angle * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const cot = cos / Math.max(sin, 1e-6);
  const t = p.thickness;
  const w = p.width;
  const warnings = [];

  const box = (size, offset) => {
    const cube = Manifold.cube(size, false);
    const moved = cube.translate(offset);
    cube.delete();
    return moved;
  };

  const armASolid = box([p.armA, w, t], [0, -w / 2, -t]);
  const armBBase = box([p.armB, w, t], [0, -w / 2, -t]);
  const armBSolid = armBBase.rotate([0, -p.angle, 0]);
  armBBase.delete();

  let body = armASolid.add(armBSolid);
  armASolid.delete();
  armBSolid.delete();

  if (p.faces === 3) {
    const armC = box([w, p.armC, t], [-w / 2, 0, -t]);
    const merged = body.add(armC);
    body.delete();
    armC.delete();
    body = merged;
  }

  const innerCornerX = t / Math.max(sin, 1e-6);
  const innerCornerB = t * cot;

  let ribLength = 0;
  if (p.rib) {
    const ribLimit = Math.min(p.armA - innerCornerX - 0.6, p.armB - 0.6);
    if (innerCornerX < p.armA - 2 && ribLimit > 4) {
      ribLength = Math.min(p.ribSize, ribLimit);
      if (p.ribSize > ribLimit + 0.01) {
        warnings.push('筋长度受臂长限制已自动缩短');
      }
      const tri = [
        [innerCornerX, 0],
        [innerCornerX + ribLength, 0],
        [innerCornerX + ribLength * cos, ribLength * sin],
      ];
      const cross = new CrossSection([tri]);
      const maxThickness = w / Math.max(1, p.ribCount) - 0.4;
      const ribT = Math.min(p.ribThickness, Math.max(1.2, maxThickness));
      if (ribT < p.ribThickness - 0.01) {
        warnings.push('加强筋数量较多，筋厚度已自动收窄');
      }
      for (let i = 0; i < p.ribCount; i++) {
        const cy = -w / 2 + (w * (i + 0.5)) / Math.max(1, p.ribCount);
        const prism = Manifold.extrude(cross, ribT);
        const oriented = prism.rotate([90, 0, 0]);
        prism.delete();
        const rib = oriented.translate([0, cy + ribT / 2, 0]);
        oriented.delete();
        const merged = body.add(rib);
        body.delete();
        rib.delete();
        body = merged;
      }
      cross.delete();
    } else {
      warnings.push('当前角度与臂长下内角空间不足，已跳过加强筋');
    }
  }

  if (p.angle < 55) {
    warnings.push('小角度下两臂会明显重叠，内角空间被填充，属正常现象');
  }

  const rHole = p.holeDia / 2;
  const sinkDepth = p.countersink ? Math.min(t * 0.55, p.holeDia * 0.425) : 0;
  const headRadius = rHole + sinkDepth;
  const cutters = [];

  const pushHole = (cx, cy, innerFaceZ, rotateB) => {
    let hole = Manifold.cylinder(
      t + 2,
      rHole,
      rHole,
      HOLE_SEGMENTS,
      true
    ).translate([cx, cy, -t / 2]);
    if (sinkDepth > 0) {
      const coneBase = rotateB
        ? Manifold.cylinder(sinkDepth, headRadius, rHole, HOLE_SEGMENTS)
        : Manifold.cylinder(sinkDepth, rHole, headRadius, HOLE_SEGMENTS);
      const cone = coneBase.translate([
        cx,
        cy,
        rotateB ? innerFaceZ : innerFaceZ - sinkDepth,
      ]);
      coneBase.delete();
      const merged = hole.add(cone);
      hole.delete();
      cone.delete();
      hole = merged;
    }
    if (rotateB) {
      const rotated = hole.rotate([0, -p.angle, 0]);
      hole.delete();
      hole = rotated;
    }
    cutters.push(hole);
  };

  const ribFootprintA = ribLength > 0 ? innerCornerX + ribLength + 1.2 : innerCornerX;
  const ribFootprintB = ribLength > 0 ? Math.max(0, innerCornerB) + ribLength + 1.2 : Math.max(0, innerCornerB);

  if (p.connection === 'slot') {
    const slotW = p.slotWidth;
    const slotHalf = slotW / 2;
    const slotDepth = Math.min(p.slotDepth, Math.max(0.6, t - 1));
    if (slotDepth < p.slotDepth - 0.01) {
      warnings.push('槽深受板厚限制已自动减小，槽底保留 1 mm 壁厚');
    }

    const pushSlot = (centerX, innerFaceZ, rotateB) => {
      let pocket = box(
        [slotW, w + 2, slotDepth + 0.02],
        [centerX - slotHalf, -w / 2 - 1, rotateB ? innerFaceZ : innerFaceZ - slotDepth]
      );
      if (rotateB) {
        const rotated = pocket.rotate([0, -p.angle, 0]);
        pocket.delete();
        pocket = rotated;
      }
      cutters.push(pocket);
    };

    const pushSlotY = (centerY) => {
      const pocket = box(
        [w + 2, slotW, slotDepth + 0.02],
        [-w / 2 - 1, centerY - slotHalf, -slotDepth]
      );
      cutters.push(pocket);
    };

    const startA = Math.max(p.holeMargin, ribFootprintA + slotHalf + 0.4);
    const endA = p.armA - p.holeMargin;
    if (endA - startA >= slotW) {
      pushSlot((startA + endA) / 2, 0, false);
    } else {
      warnings.push('A 臂可用长度不足，无法放置卡槽');
    }

    const startB = Math.max(p.holeMargin, ribFootprintB + slotHalf + 0.4);
    const endB = p.armB - p.holeMargin;
    if (endB - startB >= slotW) {
      pushSlot((startB + endB) / 2, -t, true);
    } else {
      warnings.push('B 臂可用长度不足，无法放置卡槽');
    }

    if (p.faces === 3) {
      const startC = Math.max(p.holeMargin, w / 2 + slotHalf + 0.4);
      const endC = p.armC - p.holeMargin;
      if (endC - startC >= slotW) {
        pushSlotY((startC + endC) / 2);
      } else {
        warnings.push('C 臂可用长度不足，无法放置卡槽');
      }
    }
  } else {
    const startA = Math.max(p.holeMargin, ribFootprintA + rHole + 0.4);
    const endA = p.armA - p.holeMargin;
    const xsA = layoutHoles(startA, endA, p.holeCount, p.holeDia * 1.6, 'A 臂', warnings);
    for (const x of xsA) pushHole(x, 0, 0, false);

    const startB = Math.max(p.holeMargin, ribFootprintB + rHole + 0.4);
    const endB = p.armB - p.holeMargin;
    const xsB = layoutHoles(startB, endB, p.holeCount, p.holeDia * 1.6, 'B 臂', warnings);
    for (const x of xsB) pushHole(x, 0, -t, true);

    if (p.faces === 3) {
      const startC = Math.max(p.holeMargin, w / 2 + rHole + 0.4);
      const endC = p.armC - p.holeMargin;
      const ysC = layoutHoles(startC, endC, p.holeCount, p.holeDia * 1.6, 'C 臂', warnings);
      for (const y of ysC) pushHole(0, y, 0, false);
    }
  }

  if (cutters.length > 0) {
    let cutter = cutters[0];
    for (let i = 1; i < cutters.length; i++) {
      const merged = cutter.add(cutters[i]);
      cutter.delete();
      cutters[i].delete();
      cutter = merged;
    }
    const cut = body.subtract(cutter);
    body.delete();
    cutter.delete();
    body = cut;
  }

  if (p.connection === 'screw' && p.countersink && headRadius * 2 > w - 1.5) {
    warnings.push('沉头直径接近臂宽，建议减小孔径或加宽臂宽');
  }

  if (p.orientation === 'B') {
    const rotated = body.rotate([0, p.angle - 180, 0]);
    body.delete();
    body = rotated;
  }

  const box0 = body.boundingBox();
  const placed = body.translate([
    -(box0.min[0] + box0.max[0]) / 2,
    -(box0.min[1] + box0.max[1]) / 2,
    -box0.min[2],
  ]);
  body.delete();
  body = placed;

  const finalBox = body.boundingBox();
  const size = [
    finalBox.max[0] - finalBox.min[0],
    finalBox.max[1] - finalBox.min[1],
    finalBox.max[2] - finalBox.min[2],
  ];
  const volume = body.volume();
  const surfaceArea = body.surfaceArea();
  const status = body.status();
  const rawMesh = body.getMesh();
  const positions = rawMesh.vertProperties.slice();
  const indices = rawMesh.triVerts.slice();
  body.delete();

  return {
    mesh: { positions, indices, triangles: indices.length / 3 },
    size,
    bbox: { min: finalBox.min.slice(), max: finalBox.max.slice() },
    volume,
    surfaceArea,
    status,
    warnings,
    stats: {
      triangles: indices.length / 3,
      volume,
      weight: (volume / 1000) * 1.24,
      filament: volume / (Math.PI * 0.875 * 0.875) / 1000,
    },
  };
}
