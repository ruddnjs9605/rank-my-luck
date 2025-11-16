import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppsInToss } from '@apps-in-toss/web-framework';

// 토스 미니앱 등록
AppsInToss.registerApp({ appName: 'rankmyluck' }); // ← 요청하신 appname

const root = createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);
