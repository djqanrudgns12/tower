import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AtlasAttachmentLoader, MeshAttachment, MixFrom, Physics, RegionAttachment, Skeleton, SkeletonJson, TextureAtlas,
} from '@esotericsoftware/spine-core';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const [catalogPath, atlasRoot] = process.argv.slice(2);
const catalog = await json(catalogPath);
const atlas = new TextureAtlas(await readFile(resolve(atlasRoot, catalog.atlas), 'utf8'));
const loader = new SkeletonJson(new AtlasAttachmentLoader(atlas));
const rigs = new Map();
for (const [id, { file }] of Object.entries(catalog.rigs)) {
  rigs.set(id, loader.readSkeletonData(await json(resolve(atlasRoot, file))));
}

function sample(skeleton, clip, phase) {
  skeleton.setupPose();
  const apply = (name, time) => {
    const animation = skeleton.data.findAnimation(name);
    animation.apply(skeleton, -1, animation.duration * time, false, null, 1, MixFrom.setup, false, false, false);
  };
  if (clip === 'hit') apply('walk', phase);
  apply(clip, phase);
  skeleton.updateWorldTransform(Physics.none);
  const slots = {};
  for (const slot of skeleton.drawOrder.appliedPose) {
    const { attachment } = slot.appliedPose;
    if (!attachment || slot.data.name === 'shadow') continue;
    if (!(attachment instanceof RegionAttachment) && !(attachment instanceof MeshAttachment)) {
      throw new Error(`지원하지 않는 파츠 · ${attachment.path}`);
    }
    const region = atlas.findRegion(attachment.path);
    if (region.degrees) throw new Error(`회전한 아틀라스 영역 · ${attachment.path}`);
    if (attachment instanceof RegionAttachment) {
      const vertices = [];
      attachment.computeWorldVertices(slot, attachment.getOffsets(slot.appliedPose), vertices, 0, 2);
      slots[attachment.name] = {
        // Spine UV 순서는 좌하단·좌상단·우상단·우하단이다.
        vertices: [vertices.slice(2, 4), vertices.slice(4, 6), vertices.slice(0, 2)],
        box: [region.x, region.y, region.x + region.width, region.y + region.height],
      };
    } else {
      const vertices = [];
      attachment.computeWorldVertices(slot, 0, attachment.worldVerticesLength, vertices, 0, 2);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < vertices.length; i += 2) {
        if (vertices[i] < minX) minX = vertices[i];
        if (vertices[i] > maxX) maxX = vertices[i];
        if (vertices[i + 1] < minY) minY = vertices[i + 1];
        if (vertices[i + 1] > maxY) maxY = vertices[i + 1];
      }
      slots[attachment.name] = {
        vertices: [[minX, maxY], [maxX, maxY], [minX, minY]],
        box: [region.x, region.y, region.x + region.width, region.y + region.height],
      };
    }
  }
  const pivots = Object.fromEntries(skeleton.bones.map(({ data, appliedPose: p }) =>
    [data.name, [p.worldX, p.worldY]]));
  return { clip, phase, slots, pivots };
}

const result = {};
for (const [id, { rig, skin }] of Object.entries(catalog.entities)) {
  const skeleton = new Skeleton(rigs.get(rig));
  skeleton.setSkin(skin);
  const parents = Object.fromEntries(skeleton.bones.map(({ data }) => [data.name, data.parent?.name ?? null]));
  skeleton.setupPoseSlots();
  const slots = Object.fromEntries(skeleton.slots.filter(slot => slot.pose.attachment).map(({ data, pose }) =>
    [pose.attachment.name, data.boneData.name]));
  const poses = [];
  for (const [clip, phases] of [
    ['walk', Array.from({ length: 13 }, (_, i) => i / 12)],
    ['hit', [0, .1, .2, .3125, .4, .5, .625, .75, .875, 1]],
    ['fall', [0, .1, .2, .3, .22 / .52, .5, .625, .75, .875, 1]],
  ]) {
    poses.push(...phases.map(phase => sample(skeleton, clip, phase)));
  }
  result[id] = { slots, parents, poses };
}
console.log(JSON.stringify({ page: atlas.pages[0].name, actors: result }));
