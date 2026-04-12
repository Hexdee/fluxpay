"use client";

import { useMemo } from "react";
import { useToast } from "@/components/ToastProvider";
import { ClipboardIcon } from "@/components/Icons";
import { copyToClipboard } from "@/lib/utils";

function shorten(value: string, head: number, tail: number) {
  if (!value) return "";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export default function TruncateCopy({
  value,
  label = "Copy",
  head = 8,
  tail = 6,
  monospace = true,
}: {
  value: string;
  label?: string;
  head?: number;
  tail?: number;
  monospace?: boolean;
}) {
  const toast = useToast();
  const display = useMemo(() => shorten(value, head, tail), [value, head, tail]);

  async function handleCopy() {
    try {
      const copied = await copyToClipboard(value);
      if (copied) {
        toast.success("Copied.");
      } else {
        toast.error("Clipboard is unavailable on this browser.");
      }
    } catch {
      toast.error("Unable to copy.");
    }
  }

  if (!value) return null;

  return (
    <span className="truncate-copy" title={value}>
      <span className={monospace ? "truncate-copy-value mono" : "truncate-copy-value"}>
        {display}
      </span>
      <button
        className="copy-btn"
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void handleCopy();
        }}
        aria-label={label}
        title={label}
      >
        <ClipboardIcon />
      </button>
    </span>
  );
}
