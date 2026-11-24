/* global document */
import {
  AnimationState, AnimationStateData, AssetManager, AtlasAttachmentLoader, ManagedWebGLRenderingContext,
  Physics, SceneRenderer, Skeleton, SkeletonJson,
} from '@esotericsoftware/spine-webgl';

export const adapter = {
  async start(scene) {
    const { width, height } = scene.scale;
    const canvas = document.createElement('canvas');
    Object.assign(canvas, { width, height, className: 'overlay' });
    document.querySelector('#stage').append(canvas);
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error('직접 WebGL 컨텍스트를 열 수 없습니다.');
    const context = new ManagedWebGLRenderingContext(gl);
    const renderer = new SceneRenderer(canvas, context);
    renderer.camera.setViewport(width, height);
    renderer.camera.position.set(width / 2, height / 2, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    const assets = new AssetManager(context, 'packed/');
    const [atlas, data] = await Promise.all([
      assets.loadTextureAtlasAsync('walker.atlas'),
      assets.loadJsonAsync('walker.json'),
    ]);
    const skeletonData = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(data);
    const stateData = new AnimationStateData(skeletonData);
    const units = [];
    scene.game.events.on('postrender', (_renderer, _time, delta) => {
      gl.clear(gl.COLOR_BUFFER_BIT);
      renderer.begin();
      for (const { skeleton, state } of units) {
        state.update(delta / 1000);
        state.apply(skeleton);
        skeleton.updateWorldTransform(Physics.update);
        renderer.drawSkeleton(skeleton);
      }
      renderer.end();
    });
    return { units, skeletonData, stateData, height };
  },
  async add(_scene, x, y, tier, loaded) {
    const skeleton = new Skeleton(loaded.skeletonData);
    skeleton.setSkin(`T${tier + 1}`);
    skeleton.setupPoseSlots();
    skeleton.x = x;
    skeleton.y = loaded.height - y;
    const state = new AnimationState(loaded.stateData);
    loaded.units.push({ skeleton, state });
    return (name, time) => {
      state.clearTracks();
      skeleton.setupPose();
      const track = state.setAnimation(0, name, name === 'walk');
      track.trackTime = time;
    };
  },
};
