type IconProps = { className?: string };

export function BuildingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4 3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18h-2v-3h-2v3H4V3Zm2 3v2h2V6H6Zm0 4v2h2v-2H6Zm4-4v2h2V6h-2Zm0 4v2h2v-2h-2Z" />
      <path d="M15 8h4a1 1 0 0 1 1 1v12h-5v-3h-2v3h-0V9c0-.35.14-.63.36-.83A1 1 0 0 1 15 8Zm2 3v2h2v-2h-2Zm0 4v2h2v-2h-2Z" opacity=".55" />
    </svg>
  );
}

export function KeyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M14.5 2a6.5 6.5 0 0 0-6.16 8.59L2 17v3a2 2 0 0 0 2 2h3v-2h2v-2h2l2.41-2.41A6.5 6.5 0 1 0 14.5 2Zm2 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
    </svg>
  );
}

export function TagIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.59 12.59 12 21.17a2 2 0 0 1-2.83 0l-6.34-6.34a2 2 0 0 1 0-2.83L11.41 3.4A2 2 0 0 1 12.83 2.8L20 3a1 1 0 0 1 1 1l.2 7.17a2 2 0 0 1-.61 1.42ZM16.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  );
}

export function MessageIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.02 2 11c0 2.61 1.23 4.95 3.2 6.6-.1 1.2-.5 2.6-1.2 3.9 1.6-.2 3.4-.8 4.8-1.8 1 .3 2.1.4 3.2.4 5.52 0 10-4.02 10-9S17.52 2 12 2Z" />
    </svg>
  );
}

export function AddCircleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="#67A0FF" />
      <path d="M12 8v8M8 12h8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 8a2 2 0 0 1 2-2h1.5l.8-1.2A2 2 0 0 1 10 4h4a2 2 0 0 1 1.7.8L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
        stroke="#010028"
        strokeOpacity=".55"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="13" r="3" stroke="#010028" strokeOpacity=".55" strokeWidth="1.5" />
    </svg>
  );
}

export function MicIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="#010028" strokeOpacity=".55" strokeWidth="1.5" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="#010028" strokeOpacity=".55" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="12" fill="url(#send-gradient)" />
      <path d="M8 12.5 16 8l-2 8.5-2-3-4-1Z" fill="white" />
      <defs>
        <linearGradient id="send-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67A0FF" />
          <stop offset="1" stopColor="#183EEB" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LogoMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" fill="white" />
      <g mask="url(#logo-mask)">
        <rect x="7" y="6" width="10" height="12" rx="3" fill="url(#logo-gradient)" />
      </g>
      <rect x="13.4" y="10" width="2.4" height="4" rx="1.1" fill="url(#logo-gradient)" />
      <defs>
        <linearGradient id="logo-gradient" x1="7" y1="6" x2="17" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67A0FF" />
          <stop offset="1" stopColor="#183EEB" />
        </linearGradient>
        <mask id="logo-mask">
          <rect x="7" y="6" width="10" height="12" fill="white" />
          <rect x="12.3" y="8.3" width="6" height="7.4" rx="1.8" fill="black" />
        </mask>
      </defs>
    </svg>
  );
}
