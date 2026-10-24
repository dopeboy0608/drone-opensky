import { QueryClient } from '@tanstack/react-query';

// App과 index.tsx(첫 렌더 전 캐시 하이드레이션)가 같은 인스턴스를 공유해야 해서 모듈로 분리한다.
export const queryClient = new QueryClient();
