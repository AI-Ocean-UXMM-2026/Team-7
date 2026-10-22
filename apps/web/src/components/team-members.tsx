"use client";

import { useEffect, useState, useCallback } from "react";

export interface ShopMember {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "admin" | "staff";
  createdAt: string;
}

export interface ShopInvitation {
  id: string;
  shopId: string;
  email: string;
  role: "admin" | "staff";
  createdAt: string;
  createdBy?: string | null;
}

interface TeamData {
  members: ShopMember[];
  invitations: ShopInvitation[];
  currentUserId: string;
  currentRole: "owner" | "admin" | "staff";
  canManage: boolean;
  isOwner: boolean;
}

export function TeamMembers({ shopId, isOwner }: { shopId: string; isOwner: boolean }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/shop-members?shop_id=${encodeURIComponent(shopId)}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as TeamData & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to load team members.");
      }
      setData(json);
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load team.",
      });
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/shop-members", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, email: email.trim(), role }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to send invitation.");
      }
      setEmail("");
      setNotice({ type: "success", text: json.message || "Invitation sent successfully!" });
      await loadTeam();
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send invitation.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateRole(memberId: string, newRole: "admin" | "staff") {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/shop-members", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, user_id: memberId, role: newRole }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to update member role.");
      }
      setNotice({ type: "success", text: json.message || "Member role updated." });
      await loadTeam();
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update role.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!window.confirm(`Are you sure you want to remove "${memberName}" from this shop?`)) {
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/shop-members", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, user_id: memberId }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to remove member.");
      }
      setNotice({ type: "success", text: json.message || "Member removed from shop." });
      await loadTeam();
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to remove member.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelInvitation(invitationId: string, inviteEmail: string) {
    if (!window.confirm(`Cancel invitation for "${inviteEmail}"?`)) {
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/shop-members", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, invitation_id: invitationId }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to cancel invitation.");
      }
      setNotice({ type: "success", text: json.message || "Invitation cancelled." });
      await loadTeam();
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to cancel invitation.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="team-management-heading">
      <div className="card-heading">
        <div>
          <h2 id="team-management-heading">Team &amp; Workspace Sharing</h2>
          <p className="muted">
            Manage your shop members and invite collaborators. Shop owners have full control over permissions and access.
          </p>
        </div>
        <span className="badge status-info">
          {data?.currentRole ? `${data.currentRole[0]?.toUpperCase()}${data.currentRole.slice(1)} Mode` : "Team"}
        </span>
      </div>

      {notice && (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.6rem",
            marginBottom: "1rem",
            fontSize: "0.9rem",
            backgroundColor: notice.type === "success" ? "#eefbf3" : "#fdf2f2",
            color: notice.type === "success" ? "#1e7e44" : "#9b2530",
            border: `1px solid ${notice.type === "success" ? "#c3edd3" : "#f8b4b4"}`,
          }}
        >
          {notice.text}
        </div>
      )}

      {/* Active Members List */}
      <div style={{ marginTop: "1rem", marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", color: "#183153" }}>
          Active Members ({data?.members.length ?? 0})
        </h3>

        {loading ? (
          <p className="muted">Loading team members…</p>
        ) : data?.members && data.members.length > 0 ? (
          <div style={{ display: "grid", gap: "0.65rem" }}>
            {data.members.map((member) => {
              const isSelf = member.id === data.currentUserId;
              const isTargetOwner = member.role === "owner";
              const canEditRole = data.isOwner && !isTargetOwner && !isSelf;
              const canRemove =
                (data.isOwner && !isTargetOwner && !isSelf) ||
                (data.currentRole === "admin" && member.role === "staff" && !isSelf);

              return (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    padding: "0.85rem 1.15rem",
                    border: "1px solid #cfe2f8",
                    borderRadius: "0.8rem",
                    background: isSelf ? "#fbfdff" : "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        backgroundColor: isTargetOwner ? "#245dd0" : "#e0ecf8",
                        color: isTargetOwner ? "#ffffff" : "#245dd0",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                      }}
                    >
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <strong style={{ color: "#172c78", fontSize: "0.95rem" }}>{member.displayName}</strong>
                        {isSelf && (
                          <span style={{ fontSize: "0.75rem", color: "#506987", fontWeight: 500 }}>(You)</span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#506987" }}>
                        {member.email} · Joined {member.createdAt.slice(0, 10)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span
                      className={`badge ${
                        member.role === "owner"
                          ? "status-info"
                          : member.role === "admin"
                          ? "status-warning"
                          : "status-neutral"
                      }`}
                      style={{ textTransform: "capitalize" }}
                    >
                      {member.role}
                    </span>

                    {/* Role changer dropdown/buttons for shop owner */}
                    {canEditRole && (
                      <select
                        disabled={busy}
                        value={member.role}
                        onChange={(e) => void handleUpdateRole(member.id, e.target.value as "admin" | "staff")}
                        style={{
                          padding: "0.35rem 0.5rem",
                          fontSize: "0.82rem",
                          border: "1px solid #b5cde8",
                          borderRadius: "0.45rem",
                          background: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <option value="staff">Role: Staff</option>
                        <option value="admin">Role: Admin</option>
                      </select>
                    )}

                    {/* Remove Member button */}
                    {canRemove && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRemoveMember(member.id, member.displayName)}
                        style={{
                          color: "#9b2530",
                          background: "transparent",
                          border: "1px solid #f8b4b4",
                          padding: "0.35rem 0.65rem",
                          borderRadius: "0.45rem",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">No members found.</p>
        )}
      </div>

      {/* Pending Invitations */}
      {data?.invitations && data.invitations.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", color: "#183153" }}>
            Pending Invitations ({data.invitations.length})
          </h3>
          <div style={{ display: "grid", gap: "0.65rem" }}>
            {data.invitations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "0.75rem 1rem",
                  border: "1px dashed #b5cde8",
                  borderRadius: "0.8rem",
                  background: "#f9fbfe",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <strong style={{ color: "#183153", fontSize: "0.92rem" }}>{inv.email}</strong>
                    <span className="badge status-warning" style={{ fontSize: "0.72rem" }}>
                      Invited as {inv.role}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#506987", marginTop: "0.15rem" }}>
                    Sent on {inv.createdAt.slice(0, 10)} · Automatically joins when they log in
                  </div>
                </div>

                {(data.canManage || isOwner) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCancelInvitation(inv.id, inv.email)}
                    style={{
                      color: "#9b2530",
                      background: "transparent",
                      border: "0",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "0.3rem 0.5rem",
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Member Form for Owners / Admins */}
      {(data?.canManage || isOwner) && (
        <div
          style={{
            borderTop: "1px solid #e0ecf8",
            paddingTop: "1.25rem",
            marginTop: "1.25rem",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.35rem", color: "#183153" }}>
            Invite New Collaborator
          </h3>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.85rem" }}>
            Enter the colleague’s email address. Once invited, they can sign in with Google or email to automatically access this shop.
          </p>
          <form
            onSubmit={(e) => void handleInvite(e)}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.8rem",
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: "0.35rem", fontWeight: 600, fontSize: "0.88rem" }}>
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@gmail.com"
                style={{
                  width: "100%",
                  padding: "0.65rem",
                  border: "1px solid #b5cde8",
                  borderRadius: "0.6rem",
                  fontSize: "0.9rem",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem", fontWeight: 600, fontSize: "0.88rem" }}>
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "staff" | "admin")}
                style={{
                  width: "100%",
                  padding: "0.65rem",
                  border: "1px solid #b5cde8",
                  borderRadius: "0.6rem",
                  fontSize: "0.9rem",
                  background: "#fff",
                }}
              >
                <option value="staff">Staff (Orders, Vouchers, Expenses)</option>
                <option value="admin">Admin (Full shop settings &amp; invitations)</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={busy || !email.trim()}
              style={{
                padding: "0.7rem 1.25rem",
                border: 0,
                borderRadius: "0.6rem",
                background: "#245dd0",
                color: "white",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: busy || !email.trim() ? "not-allowed" : "pointer",
                opacity: busy || !email.trim() ? 0.7 : 1,
              }}
            >
              {busy ? "Sending…" : "Send Invite"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
