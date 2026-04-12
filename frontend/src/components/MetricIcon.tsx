import type { IconName } from "@/lib/types";
import {
  BoltIcon,
  ChartUpIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyIcon,
  LinkIcon,
  WalletIcon,
  WarningIcon,
} from "@/components/Icons";

export default function MetricIcon({ icon }: { icon: IconName }) {
  switch (icon) {
    case "wallet":
      return <WalletIcon />;
    case "check-circle":
      return <CheckCircleIcon />;
    case "chart-up":
      return <ChartUpIcon />;
    case "bolt":
      return <BoltIcon />;
    case "link":
      return <LinkIcon />;
    case "currency":
      return <CurrencyIcon />;
    case "clock":
      return <ClockIcon />;
    case "warning":
      return <WarningIcon />;
    default:
      return <ChartUpIcon />;
  }
}
