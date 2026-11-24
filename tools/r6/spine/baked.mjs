export const adapter = {
  preload(scene) {
    scene.load.json('frames', 'baked/frames.json');
    scene.load.spritesheet('walker', 'baked/walker.webp', { frameWidth: 56, frameHeight: 56 });
  },
  async start(scene) {
    const layout = scene.cache.json.get('frames');
    for (const [tier, clips] of layout.skins.entries()) {
      for (const [name, { start, count }] of Object.entries(clips)) {
        scene.anims.create({
          key: `${tier}-${name}`,
          frames: scene.anims.generateFrameNumbers('walker', { start, end: start + count - 1 }),
          frameRate: layout.fps,
          repeat: name === 'walk' ? -1 : 0,
          skipMissedFrames: true,
        });
      }
    }
    return layout;
  },
  async add(scene, x, y, tier, layout) {
    const unit = scene.add.sprite(x, y, 'walker').setOrigin(layout.pivot[0] / 56, layout.pivot[1] / 56);
    return (name, time) => unit.play({
      key: `${tier}-${name}`,
      startFrame: Math.min(layout.skins[tier][name].count - 1, Math.floor(time * layout.fps)),
    });
  },
};
