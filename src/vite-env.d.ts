/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 기록·랭킹 서버 주소(예: https://voca-api.example.com). 비우면 이 기기 기록 모드로만 돈다. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
