import * as React from 'react';

type IconProps = {
  className?: string;
};

function Svg({
  className,
  children,
  viewBox = '0 0 24 24',
}: React.PropsWithChildren<{ className?: string; viewBox?: string }>) {
  return (
    <svg
      aria-hidden='true'
      className={className}
      fill='none'
      viewBox={viewBox}
      xmlns='http://www.w3.org/2000/svg'
    >
      {children}
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0a7 7 0 0114 0z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function ChartUpIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M4 16l5-5l4 4l7-7' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
      <path d='M15 8h5v5' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function LayoutIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x='4' y='4' width='16' height='16' rx='2.5' stroke='currentColor' strokeWidth='1.8' />
      <path d='M10 4v16M10 10h10' stroke='currentColor' strokeLinecap='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function WalletIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M4 8.5A2.5 2.5 0 016.5 6H18a2 2 0 012 2v8a2 2 0 01-2 2H6.5A2.5 2.5 0 014 15.5v-7z' stroke='currentColor' strokeWidth='1.8' />
      <path d='M4 9h12.5A2.5 2.5 0 0119 11.5v1A2.5 2.5 0 0116.5 15H4' stroke='currentColor' strokeLinecap='round' strokeWidth='1.8' />
      <circle cx='15.5' cy='12' r='1.1' fill='currentColor' />
    </Svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M10 14l4-4' stroke='currentColor' strokeLinecap='round' strokeWidth='1.8' />
      <path d='M7.5 14.5l-1 1a3.18 3.18 0 104.5 4.5l1-1' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
      <path d='M16.5 9.5l1-1A3.18 3.18 0 0013 4l-1 1' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function CodeIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M9 8l-4 4l4 4M15 8l4 4l-4 4M13 5l-2 14' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function BoltIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M13 2L5 13h5l-1 9l8-11h-5l1-9z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx='12' cy='12' r='8' stroke='currentColor' strokeWidth='1.8' />
      <path d='M8.5 12.2l2.2 2.2l4.8-5' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M7 10a5 5 0 1110 0v3.2l1.2 2.1A1 1 0 0117.3 17H6.7a1 1 0 01-.9-1.7L7 13.2V10z' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.8' />
      <path d='M10 19a2 2 0 004 0' stroke='currentColor' strokeLinecap='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M12 5v14M5 12h14' stroke='currentColor' strokeLinecap='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M12 8.8A3.2 3.2 0 1112 15.2A3.2 3.2 0 0112 8.8z' stroke='currentColor' strokeWidth='1.8' />
      <path d='M19.4 13.5l1-1.5l-1-1.5l-1.9-.2a6 6 0 00-.7-1.6l1.1-1.6l-1.5-1.4l-1.6 1a6 6 0 00-1.7-.7L13.5 3h-3l-.3 1.9a6 6 0 00-1.7.7l-1.6-1L5.4 6l1 1.6a6 6 0 00-.7 1.6l-1.9.3l-1 1.5l1 1.5l1.9.2c.1.6.4 1.1.7 1.6l-1 1.6l1.5 1.4l1.6-1c.5.3 1.1.5 1.7.7l.3 1.9h3l.3-1.9c.6-.1 1.2-.4 1.7-.7l1.6 1l1.5-1.4l-1.1-1.6c.3-.5.6-1 .7-1.6l1.9-.3z' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.4' />
    </Svg>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M8 4h6l4 4v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.8' />
      <path d='M14 4v4h4M9 13h6M9 17h6M9 9h2' stroke='currentColor' strokeLinecap='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M12 4v10M8 10l4 4l4-4M5 18h14' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M20 5v5h-5M4 19v-5h5' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
      <path d='M18 10a7 7 0 00-12.1-2.2M6 14a7 7 0 0012.1 2.2' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx='12' cy='12' r='8' stroke='currentColor' strokeWidth='1.8' />
      <path d='M12 8v4l3 2' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function CurrencyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M12 4v16M16 8.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5S9.8 11 12 11s4 1.1 4 2.5S14.2 16 12 16s-4-1.1-4-2.5' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function WarningIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M12 5l8 14H4L12 5z' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.8' />
      <path d='M12 10v4M12 17h.01' stroke='currentColor' strokeLinecap='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M9 6v12M15 6v12' stroke='currentColor' strokeLinecap='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M9 7l8 5l-8 5V7z' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.8' fill='currentColor' />
    </Svg>
  );
}

export function ExternalLinkIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M14 5h5v5M10 14l9-9M19 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function ClipboardIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x='7' y='5' width='10' height='15' rx='2' stroke='currentColor' strokeWidth='1.8' />
      <path d='M10 5.5h4a1 1 0 001-1v0a1.5 1.5 0 00-1.5-1.5h-3A1.5 1.5 0 009 4.5v0a1 1 0 001 1z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M2.5 12s3.5-6 9.5-6s9.5 6 9.5 6s-3.5 6-9.5 6s-9.5-6-9.5-6z' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.8' />
      <circle cx='12' cy='12' r='3' stroke='currentColor' strokeWidth='1.8' />
    </Svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx='12' cy='8' r='3.5' stroke='currentColor' strokeWidth='1.8' />
      <path d='M5 19a7 7 0 0114 0' stroke='currentColor' strokeLinecap='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function FilterIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M4 6h16M7 12h10M10 18h4' stroke='currentColor' strokeLinecap='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M12 3l7 3v5c0 4.4-2.9 8.5-7 10c-4.1-1.5-7-5.6-7-10V6l7-3z' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.8' />
      <path d='M9.5 12.5l1.8 1.8l3.5-3.8' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M10 7l5 5l-5 5' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' />
    </Svg>
  );
}

export function QrCodeIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d='M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM15 15h1v1h-1zM18 14h1v1h-1zM14 18h1v1h-1zM17 17h2v2h-2z' stroke='currentColor' strokeWidth='1.8' />
    </Svg>
  );
}
