import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './ui/styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

const root = document.getElementById('root');
if (!root) throw new Error('root 요소가 없다');

// 글꼴이 준비된 뒤 그리면 Phaser 글자·보기 줄 수 측정이 바뀌지 않는다.
void document.fonts.ready.finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
