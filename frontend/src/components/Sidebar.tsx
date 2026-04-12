"use client";

import Link from "next/link";
import Brand from "./Brand";
import {
  BoltIcon,
  CodeIcon,
  DocumentIcon,
  LayoutIcon,
  LinkIcon,
  SettingsIcon,
  WalletIcon,
} from "./Icons";
import { api } from "@/lib/api";
import { useMerchant } from "@/components/MerchantProvider";
import { useApiResource } from "@/hooks/useApiResource";

type SidebarProps = {
  active?: string;
};

const navSections = [
  {
    title: "Core",
    items: [
      { label: "Overview", icon: <LayoutIcon />, href: "/dashboard", key: "overview" },
      { label: "Payments", icon: <WalletIcon />, href: "/payments", key: "payments" },
      { label: "Payment links", icon: <LinkIcon />, href: "/payment-links", key: "links" },
    ],
  },
  {
    title: "Developers",
    items: [
      { label: "API keys", icon: <CodeIcon />, href: "/api-keys", key: "api" },
      { label: "Webhooks", icon: <BoltIcon />, href: "/webhooks", key: "webhooks" },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "Docs", icon: <DocumentIcon />, href: "/docs", key: "docs" },
      { label: "Settings", icon: <SettingsIcon />, href: "/settings", key: "settings" },
    ],
  },
];

export default function Sidebar({ active }: SidebarProps) {
  const merchant = useMerchant();
  const notifications = useApiResource(api.notifications);

  const unreadCount = notifications.data?.filter((item) => !item.read).length ?? 0;
  const profile = merchant.profile;
  const initials = (profile?.name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

  return (
    <aside className="sidebar">
      <Brand variant="dark" href="/" />

      {navSections.map((section) => (
        <section className="nav-section" key={section.title}>
          <div className="nav-title">{section.title}</div>
          <nav className="nav-list">
            {section.items.map((item) => (
              <Link
                key={item.key}
                className={`nav-item${active === item.key ? " active" : ""}`}
                href={item.href}
              >
                <span className="nav-left">
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </span>
                {item.key === "webhooks" && unreadCount > 0 ? (
                  <span className="nav-badge">{unreadCount}</span>
                ) : null}
              </Link>
            ))}
          </nav>
        </section>
      ))}

      <section className="sidebar-footer">
        <div className="profile-row">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="profile-avatar">{initials}</div>
            <div>
              <div className="profile-name">{profile?.name ?? "Loading account"}</div>
            </div>
          </div>
          {profile?.brandAccent ? (
            <span className="status-chip" title={`Brand accent: ${profile.brandAccent}`}>
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: profile.brandAccent,
                  boxShadow: "0 0 0 2px rgba(255,255,255,0.12)",
                }}
              />
              {profile.brandAccent.toUpperCase()}
            </span>
          ) : null}
        </div>
        {profile?.email ? <div className="profile-sub">{profile.email}</div> : null}
      </section>
    </aside>
  );
}
