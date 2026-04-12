import Brand from "./Brand";
import * as React from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  action?: string;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
};

export default function AuthShell({
  title,
  description,
  children,
  footer,
  action,
  onSubmit,
}: AuthShellProps) {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <Brand />
        <h1>{title}</h1>
        <p>{description}</p>
        <form className="auth-form" method="post" action={action} onSubmit={onSubmit}>
          {children}
        </form>
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </div>
    </main>
  );
}
