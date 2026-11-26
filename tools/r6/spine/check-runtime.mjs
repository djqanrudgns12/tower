import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AtlasAttachmentLoader, MixFrom, Physics, Skeleton, SkeletonJson, TextureAtlas,
} from '@esotericsoftware/spine-core';

const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const tolerance = 0.001;
const work = process.argv[2];
if (!work) throw new Error('사용법 · node tools/r6/spine/check-runtime.mjs <작업 폴더>');
const out = resolve(work, 'export');
const manifest = await json(resolve(work, 'manifest-fragment.json'));
const [species] = Object.keys(manifest.species);
const atlasStats = await json(resolve(out, 'atlas-report.json'));
const atlas = new TextureAtlas(await readFile(resolve(out, manifest.atlases[species]), 'utf8'));
assert.equal(atlas.pages.length, 1, '종족 아틀라스는 한 장이어야 합니다.');
const [page] = atlas.pages;
assert.ok(page.width > 0 && page.width <= 2048 && page.height > 0 && page.height <= 2048,
  '아틀라스 치수가 2048×2048 범위를 벗어났습니다.');
assert.deepEqual([page.width, page.height, page.pma, page.name], [
  atlasStats.width, atlasStats.height, false, `${species}.webp`,
]);
const texture = await readFile(resolve(out, species, page.name));
assert.equal(texture.length, atlasStats.bytes);
assert.equal(createHash('sha256').update(texture).digest('hex'), atlasStats.sha256);

function pose(skeleton, animation, time) {
  skeleton.setupPose();
  animation.apply(skeleton, -1, time, false, null, 1, MixFrom.setup, false, false, false);
  skeleton.updateWorldTransform(Physics.none);
  return skeleton.bones.flatMap(({ appliedPose: p }) => [p.worldX, p.worldY, p.a, p.b, p.c, p.d]);
}

const maxDelta = (first, second) => Math.max(...first.map((value, i) => Math.abs(value - second[i])));
const data = new Map();
const motion = {};
for (const [rigId, rig] of Object.entries(manifest.rigs)) {
  const skeletonData = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(
    await json(resolve(out, rig.file)),
  );
  data.set(rigId, skeletonData);
  const skeleton = new Skeleton(skeletonData);
  const walk = skeletonData.findAnimation('walk');
  const start = pose(skeleton, walk, 0);
  const end = pose(skeleton, walk, walk.duration);
  const seam = maxDelta(start, end);
  const clips = ['walk', 'hit', 'fall'];
  if (rigId.includes('-boss-')) clips.push('boss-skill');
  for (const clip of clips) {
    const animation = skeletonData.findAnimation(clip);
    assert.ok(animation?.duration > 0, `${rigId}/${clip} 동작 누락`);
    assert.ok(maxDelta(pose(skeleton, animation, 0), pose(skeleton, animation, animation.duration * .35)) > .01,
      `${rigId}/${clip} 동작이 정지 상태입니다.`);
  }
  assert.ok(seam <= tolerance, `${rigId} 걷기 루프 경계 차이 · ${seam}`);
  const before = pose(skeleton, walk, walk.duration * .999);
  const after = pose(skeleton, walk, walk.duration * .001);
  const jump = maxDelta(before, after);
  assert.ok(jump < .1, `${rigId} 걷기 루프의 전후 간격 · ${jump}`);
  motion[rigId] = { duration: walk.duration, seam, jump };
}

const sourceRigs = new Map();
for (const rigId of data.keys()) sourceRigs.set(rigId, await json(resolve(work, 'rigs', rigId + '.json')));
for (const [id, actor] of Object.entries(manifest.species[species].entities)) {
  const skeleton = new Skeleton(data.get(actor.rig));
  const source = sourceRigs.get(actor.rig);
  const expected = source.skins.find(skin => skin.name === actor.skin).attachments;
  skeleton.setSkin(actor.skin);
  skeleton.setupPoseSlots();
  assert.deepEqual(
    skeleton.slots.filter(slot => slot.pose.attachment).map(slot => slot.data.name).sort(),
    Object.keys(expected).sort(),
    `${id} 슬롯 부착물 불일치`,
  );
  for (const slot of skeleton.slots) {
    const name = slot.data.name;
    const region = slot.pose.attachment;
    if (!region) continue;
    const input = expected[name][slot.data.attachmentName];
    assert.equal(region.path, input.path, `${id}/${name} 아틀라스 연결 불일치`);
    const before = [input.x, input.y, input.width * input.scaleX, input.height * input.scaleY];
    const after = [region.x, region.y, region.width * region.scaleX, region.height * region.scaleY];
    assert.ok(maxDelta(before, after) <= tolerance, `${id}/${name} 저작 위치 또는 크기 불일치`);
  }
}
await writeFile(resolve(out, 'motion-report.json'), JSON.stringify(motion, null, 2) + '\n');
console.log(`Spine 런타임 · ${data.size}개 뼈대 · 걷기 이음새·동작·스킨 부착물 통과`);
