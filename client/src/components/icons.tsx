import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export function IconDashboard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

export function IconCar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 16.5h14" />
      <path d="M6.5 16.5 5.6 12 7.4 7.8A2 2 0 0 1 9.2 6.5h5.6a2 2 0 0 1 1.8 1.3L18.4 12l-.9 4.5" />
      <path d="M4 12h16" />
      <circle cx="7.2" cy="16.8" r="1.6" />
      <circle cx="16.8" cy="16.8" r="1.6" />
    </svg>
  );
}

export function IconKey(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8-8" />
      <path d="m16.5 6.5 2.2 2.2" />
      <path d="m13.6 9.4 2 2" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.6 19.2c.6-3 2.8-4.7 5.4-4.7s4.8 1.7 5.4 4.7" />
      <path d="M15.4 5.6a3 3 0 0 1 0 5.8" />
      <path d="M16.6 14.8c2 .4 3.4 1.9 3.9 4.4" />
    </svg>
  );
}

export function IconChart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4v15.5h16" />
      <path d="m7.5 14 3.3-3.6 2.7 2.4 4.4-5" />
      <path d="M15.6 7.6h2.3v2.3" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconWrench(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.5 6.2a4.2 4.2 0 0 0 5.3 5.3l-8.6 8.6a2.8 2.8 0 0 1-4-4l8.6-8.6a4.2 4.2 0 0 0-1.3-1.3Z" />
    </svg>
  );
}

export function IconTrend(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4 16 5-5 3.5 3L20 6.5" />
      <path d="M15.5 6.5H20v4.5" />
    </svg>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 11l5.6-2Z" />
    </svg>
  );
}

export function IconCompass(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.4 8.6-2 4.8-4.8 2 2-4.8Z" />
    </svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function IconArrow(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h13" />
      <path d="m13.5 7 5 5-5 5" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
    </svg>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 3 5.5 13.5H11l-1 7.5L18.5 10H13Z" />
    </svg>
  );
}

export function IconRoad(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 4 4.5 20M16 4l3.5 16" />
      <path d="M12 5v3M12 11v3M12 17v2.5" />
    </svg>
  );
}

export function IconGauge(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 13 3.5-3.5" />
      <circle cx="12" cy="17" r="1.4" />
    </svg>
  );
}
