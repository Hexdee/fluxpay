"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DashboardShell from "@/components/DashboardShell";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/lib/api";

export default function DocDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = useMemo(
    () => decodeURIComponent(params?.slug ?? ""),
    [params?.slug],
  );

  const doc = useApiResource(() => api.docBySlug(slug));

  return (
    <DashboardShell active="docs">
      <main className="docs-shell">
        <article className="docs-article">
          <div className="eyebrow">Documentation</div>
          <h1>{doc.data?.title ?? "Documentation"}</h1>
          <p className="cell-muted">
            {doc.data?.summary ?? (doc.loading ? "Loading documentation..." : "Unable to load this doc.")}
          </p>
          {doc.data?.markdown ? (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.data.markdown}</ReactMarkdown>
            </div>
          ) : null}
        </article>
      </main>
    </DashboardShell>
  );
}
