export type QualityLevel = 0 | 1 | 2 | 3;

const LOWER_WINDOW_MS = 5000;
const RAISE_WINDOW_MS = 20_000;
const PAUSE_WINDOW_MS = 10_000;

/** 전경에서 진행 중인 판의 프레임 간격만 쓴다. 절전·복구 상태는 판 데이터에 저장하지 않는다. */
export class RenderQuality {
  private level: QualityLevel = 0;
  private light = false;
  private sampleMs = 0;
  private frames = 0;
  private healthyMs = 0;
  private severeMs = 0;

  get current(): QualityLevel { return this.level; }

  setLight(light: boolean) {
    if (light === this.light) return;
    this.light = light;
    this.level = light ? 3 : 0;
    this.resetSample();
  }

  resetSample() {
    this.sampleMs = this.frames = this.healthyMs = this.severeMs = 0;
  }

  /** true면 최저 품질에서도 오랜 시간 진행이 어렵다. */
  sample(dt: number): boolean {
    if (dt <= 0) return false;
    this.sampleMs += dt;
    this.frames++;
    if (this.sampleMs < LOWER_WINDOW_MS) return false;

    const elapsed = this.sampleMs;
    const fps = this.frames * 1000 / elapsed;
    this.sampleMs = this.frames = 0;
    if (fps < 30 && this.level < 3) {
      this.level = (this.level + 1) as QualityLevel;
      this.healthyMs = 0;
      return false;
    }
    // 30fps 미만이면 품질을 낮추되, 화면이 진행 가능한 수준이면 그대로 플레이한다.
    this.severeMs = fps < 15 ? this.severeMs + LOWER_WINDOW_MS : 0;
    this.healthyMs = fps >= 45 ? this.healthyMs + LOWER_WINDOW_MS : 0;
    if (!this.light && this.level > 0 && this.healthyMs >= RAISE_WINDOW_MS) {
      this.level = (this.level - 1) as QualityLevel;
      this.healthyMs = 0;
    }
    return this.level === 3 && this.severeMs >= PAUSE_WINDOW_MS;
  }
}
