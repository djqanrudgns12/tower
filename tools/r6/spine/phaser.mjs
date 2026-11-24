import { SpinePlugin } from '@esotericsoftware/spine-phaser-v4';

export const adapter = {
  plugins: { scene: [{ key: 'spine.SpinePlugin', plugin: SpinePlugin, mapping: 'spine' }] },
  preload(scene) {
    scene.load.spineJson('walker', 'packed/walker.json');
    scene.load.spineAtlas('walker', 'packed/walker.atlas');
  },
  async add(scene, x, y, tier) {
    const unit = scene.add.spine(x, y, 'walker', 'walker', { renderer: 'phaser' });
    unit.skeleton.setSkin(`T${tier + 1}`);
    unit.skeleton.setupPoseSlots();
    return (name, time) => {
      unit.animationState.clearTracks();
      unit.skeleton.setupPose();
      const track = unit.animationState.setAnimation(0, name, name === 'walk');
      track.trackTime = time;
    };
  },
};
