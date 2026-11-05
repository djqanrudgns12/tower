// ESLint 10은 파일에서 가장 가까운 설정을 쓴다. 저장소 설정을 그대로 가져오고 wrangler 로컬 상태만 뺀다.
import root from '../eslint.config.js';

export default [{ ignores: ['.wrangler'] }, ...root];
