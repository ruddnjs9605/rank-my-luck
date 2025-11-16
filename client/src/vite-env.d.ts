/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    // 다른 VITE_ 변수 생기면 여기에 이어서 추가
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  