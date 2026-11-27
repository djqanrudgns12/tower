import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './ui/styles/global.css';
import './ui/styles/accessibility.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

const root = document.getElementById('root');
if (!root) throw new Error('root 요소가 없다');

// 글꼴이 준비된 뒤 그리면 Phaser 글자·보기 줄 수 측정이 바뀌지 않는다.
// 학교 와이파이 지연·방화벽으로 글꼴 조각 요청이 정체돼도 1.2초 안에 화면을 먼저 띄운다.
const fontsReady = typeof document.fonts?.ready?.then === 'function'
  ? Promise.race([document.fonts.ready, new Promise<void>(resolve => setTimeout(resolve, 1200))])
  : Promise.resolve();

void fontsReady.finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

if (import.meta.env.PROD && 'serviceWorker' in navigator && !navigator.webdriver) {
  const registerSw = () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  };
  if (document.readyState === 'complete') registerSw();
  else window.addEventListener('load', registerSw, { once: true });
}
