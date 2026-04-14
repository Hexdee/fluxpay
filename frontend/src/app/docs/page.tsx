"use client";

import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/lib/api";

export default function DocsPage() {
  const docs = useApiResource(api.docs);

  return (
    <DashboardShell active="docs">
      <section className="page-header">
        <div>
          <div className="eyebrow">Documentation</div>
          <h1>Developer documentation</h1>
          <p>Browse the API, SDK, contract, and architecture docs shipped with the repository.</p>
        </div>
      </section>
      <section className="feature-grid">
        {(docs.data ?? []).map((doc) => (
          <article className="feature-card" key={doc.id}>
            <h3>{doc.title}</h3>
            <p className="cell-muted">{doc.summary}</p>
            <Link className="btn btn-secondary" href={`/docs/${doc.slug}`}>
              Open doc
            </Link>
          </article>
        ))}
        {!docs.loading && !docs.data?.length ? (
          <article className="feature-card">
            <h3>No docs found</h3>
            <p className="cell-muted">Documentation records are not configured yet.</p>
          </article>
        ) : null}
      </section>
    </DashboardShell>
  );
}
