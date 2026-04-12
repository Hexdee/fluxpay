"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import type { Notification } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";

type NotificationsModalProps = {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
};

export default function NotificationsModal({ open, onClose, notifications }: NotificationsModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="medium"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={closeRef}
    >
      <div className="modal-main">
        <div className="card-head modal-head-inline">
          <div>
            <h2 id={titleId}>Notifications</h2>
            <p id={descriptionId} className="cell-muted">
              Recent account activity that needs attention.
            </p>
          </div>
          <button ref={closeRef} className="btn btn-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="detail-list">
          {notifications.length ? (
            notifications.map((notification) => (
              <div className="note-row" key={notification.id}>
                <div className="row-copy">
                  <strong>{notification.title}</strong>
                  <span>{notification.body}</span>
                </div>
                <div className="row-actions">
                  <span className={`status ${notification.read ? "info" : "ok"}`}>
                    {notification.read ? "Read" : "Unread"}
                  </span>
                  <span className="cell-muted">{formatRelativeTime(notification.createdAt)}</span>
                  <Link className="btn btn-secondary" href={notification.href} onClick={onClose}>
                    Open
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">No notifications yet.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
