import { execSync } from 'node:child_process';
import path from 'node:path';
import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';
import pkg from './package.json';

const { publicVars } = loadEnv({ prefixes: ['VITE_'] });

// GitHub Pages 프로젝트 페이지 서브경로 배포 대응 (예: /drone-opensky/). 로컬/기본 배포는 '/'.
const basePath = process.env.GH_PAGES_BASE_PATH || '/';

// 배포된 페이지 콘솔에서 버전/최근 작업을 확인할 수 있도록 빌드 시점에 주입한다
// (src/index.tsx). git 정보가 없는 환경(예: 아카이브 빌드)에서도 빌드가 깨지지
// 않도록 실패 시 빈 문자열로 대체한다.
const lastCommitMessage = (() => {
  try {
    return execSync('git log -1 --pretty=%s').toString().trim();
  } catch {
    return '';
  }
})();

// 커스텀 도메인 연결 전까지 GitHub Pages 기본 URL을 canonical/OG URL로 사용.
const siteUrl = 'https://dopeboy0608.github.io/drone-opensky/';

const siteTitle = 'Drone-OpenSky';
const siteDescription = '드론 비행 가능/제한/불가 구역을 실시간 지도 기반으로 제공하는 서비스';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact(), pluginTailwindcss()],
  source: {
    define: {
      ...publicVars,
      'import.meta.env.VITE_BASE_PATH': JSON.stringify(basePath),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
      'import.meta.env.VITE_APP_LAST_COMMIT': JSON.stringify(lastCommitMessage),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  output: {
    assetPrefix: basePath,
  },
  server: {
    base: basePath,
    // VWorld WFS는 브라우저 직접 호출 시 CORS를 막는다. dev 서버에서만 같은 오리진으로
    // 우회하도록 프록시한다 (프로덕션은 Vercel relay를 거친다 —
    // src/api/vworldClient.ts, 이슈 #16 참고).
    proxy: {
      '/vworld-api': {
        target: 'https://api.vworld.kr',
        changeOrigin: true,
        pathRewrite: { '^/vworld-api': '/req' },
      },
    },
  },
  html: {
    title: siteTitle,
    meta: {
      description: siteDescription,
      // 아직 개발 초기 단계(1단계 범위)라 색인은 보류. 정식 공개 시 제거.
      robots: 'noindex, nofollow',
      'og:title': { property: 'og:title', content: siteTitle },
      'og:description': { property: 'og:description', content: siteDescription },
      'og:type': { property: 'og:type', content: 'website' },
      'og:url': { property: 'og:url', content: siteUrl },
      'og:locale': { property: 'og:locale', content: 'ko_KR' },
      'twitter:card': { name: 'twitter:card', content: 'summary' },
      'twitter:title': { name: 'twitter:title', content: siteTitle },
      'twitter:description': { name: 'twitter:description', content: siteDescription },
    },
    tags: [
      {
        tag: 'link',
        attrs: { rel: 'canonical', href: siteUrl },
      },
    ],
  },
});
