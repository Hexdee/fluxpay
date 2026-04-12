import Link from "next/link";
import Logo from "./Logo";

type BrandProps = {
  variant?: "light" | "dark";
  href?: string;
};

export default function Brand({ variant = "light", href = "/" }: BrandProps) {
  return (
    <Link
      className={`brand${variant === "dark" ? " dark" : ""}`}
      href={href}
      aria-label="FluxPay home"
    >
      <Logo className="logo" variant={variant} />
      <span className="brand-wordmark">
        <span>Flux</span>
        <span>Pay</span>
      </span>
    </Link>
  );
}
