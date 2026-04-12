import * as React from "react";

type LogoProps = {
  variant?: "light" | "dark";
  className?: string;
};

export default function Logo({ variant = "light", className }: LogoProps) {
  const bg = variant === "dark" ? "rgba(255, 255, 255, 0.16)" : "#0f172a";
  const fg = "#ffffff";
  const stroke = variant === "dark" ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0)";

  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      role="img"
      aria-label="FluxPay logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="2" width="36" height="36" rx="12" fill={bg} stroke={stroke} />
      <rect x="14" y="10" width="4" height="20" rx="2" fill={fg} />
      <rect x="14" y="14" width="16" height="4" rx="2" fill={fg} />
      <rect x="14" y="21" width="12" height="4" rx="2" fill={fg} />
    </svg>
  );
}
