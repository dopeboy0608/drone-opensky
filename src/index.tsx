import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { queryClient } from './api/queryClient';
import { hydrateAirspaceCache } from './features/airspace/cache/hydrateAirspaceCache';

console.log(
  `[Drone-OpenSky] v${import.meta.env.VITE_APP_VERSION} — ${import.meta.env.VITE_APP_LAST_COMMIT}`,
);

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  // 캐시를 먼저 채워야 useQueries가 마운트 시 이미 신선한 데이터를 보고 네트워크 요청을 건너뛴다.
  // hydrateAirspaceCache는 실패/타임아웃을 내부에서 처리하므로 finally로 렌더를 항상 보장한다.
  hydrateAirspaceCache(queryClient).finally(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
