/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 정적 내보내기 설정
  images: {
    unoptimized: true, // GitHub Pages는 이미지 최적화 기능을 지원하지 않음
  },
  // 저장소 이름에 맞게 경로 설정 (중요!)
  basePath: '/2026-Travel-Japan',
  assetPrefix: '/2026-Travel-Japan',
};

module.exports = nextConfig;