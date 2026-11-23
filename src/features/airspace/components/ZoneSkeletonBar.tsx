interface ZoneSkeletonBarProps {
  className?: string;
  // 스크린리더에 "무엇을 기다리는지" 알릴 때만 준다. 없으면 장식으로 숨긴다.
  label?: string;
}

// 도착 전 항목의 자리를 잡는 회색 막대. 크기는 호출하는 쪽이 정해 실제 내용과 높이를 맞춘다(도착해도 카드가 튀지 않게).
// 애니메이션은 모션 감소 설정에서 멈춘다.
export const ZoneSkeletonBar = ({ className = '', label }: ZoneSkeletonBarProps) => (
  <span
    {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    className={`block animate-pulse rounded bg-gray-200 motion-reduce:animate-none ${className}`}
  />
);
