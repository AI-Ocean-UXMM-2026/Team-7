import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { uuidSchema } from "@ocean/contracts";
import { getCurrentSession, verifyShopMembership } from "@/lib/auth/session";
import { getDb } from "@/lib/db/sqlite";
import { sameOriginMutation } from "@/lib/auth/request-origin";

export const runtime = "nodejs";

export interface ShopMemberItem {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "admin" | "staff";
  createdAt: string;
}

export interface ShopInvitationItem {
  id: string;
  shopId: string;
  email: string;
  role: "admin" | "staff";
  createdAt: string;
  createdBy?: string | null;
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shopId = url.searchParams.get("shop_id");

  if (!shopId || !uuidSchema.safeParse(shopId).success) {
    return NextResponse.json({ error: "Invalid shop ID." }, { status: 400 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const membership = verifyShopMembership(session.userId, shopId);
  if (!membership.authorized || !membership.role) {
    return NextResponse.json({ error: "Shop access denied." }, { status: 403 });
  }

  const db = getDb();

  // Active members
  const memberRows = db.prepare(`
    SELECT 
      sm.user_id,
      sm.role,
      sm.created_at,
      p.email,
      p.display_name
    FROM shop_memberships sm
    JOIN profiles p ON sm.user_id = p.id
    WHERE sm.shop_id = ?
    ORDER BY 
      CASE sm.role 
        WHEN 'owner' THEN 1 
        WHEN 'admin' THEN 2 
        ELSE 3 
      END,
      sm.created_at ASC
  `).all(shopId) as Array<{
    user_id: string;
    role: string;
    created_at: string;
    email: string | null;
    display_name: string | null;
  }>;

  const members: ShopMemberItem[] = memberRows.map((r) => ({
    id: r.user_id,
    email: r.email || "No email",
    displayName: r.display_name || "Team Member",
    role: (r.role as "owner" | "admin" | "staff") || "staff",
    createdAt: r.created_at || new Date().toISOString(),
  }));

  // Pending invitations
  const inviteRows = db.prepare(`
    SELECT id, shop_id, email, role, created_at, created_by
    FROM shop_invitations
    WHERE shop_id = ?
    ORDER BY created_at DESC
  `).all(shopId) as Array<{
    id: string;
    shop_id: string;
    email: string;
    role: string;
    created_at: string;
    created_by: string | null;
  }>;

  const invitations: ShopInvitationItem[] = inviteRows.map((r) => ({
    id: r.id,
    shopId: r.shop_id,
    email: r.email,
    role: (r.role as "admin" | "staff") || "staff",
    createdAt: r.created_at,
    createdBy: r.created_by,
  }));

  return NextResponse.json({
    members,
    invitations,
    currentUserId: session.userId,
    currentRole: membership.role,
    canManage: membership.role === "owner" || membership.role === "admin",
    isOwner: membership.role === "owner",
  });
}

export async function POST(request: Request) {
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    shop_id?: unknown;
    email?: unknown;
    role?: unknown;
  } | null;

  const shopId = typeof body?.shop_id === "string" ? body.shop_id : "";
  if (!uuidSchema.safeParse(shopId).success) {
    return NextResponse.json({ error: "Valid shop ID is required." }, { status: 400 });
  }

  const email = normalizeEmail(body?.email);
  if (!email) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const role = body?.role === "admin" ? "admin" : "staff";

  // Check authorization: Owner or Admin can invite
  const membership = verifyShopMembership(session.userId, shopId);
  if (!membership.authorized || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "Only shop owners and admins can invite team members." }, { status: 403 });
  }

  const db = getDb();
  const now = new Date().toISOString();

  // Check if this email is already an active member of this shop
  const existingMember = db.prepare(`
    SELECT sm.user_id, p.display_name
    FROM shop_memberships sm
    JOIN profiles p ON sm.user_id = p.id
    WHERE sm.shop_id = ? AND lower(p.email) = ?
  `).get(shopId, email) as { user_id: string; display_name: string } | undefined;

  if (existingMember) {
    return NextResponse.json(
      { error: `"${email}" is already an active member of this shop.` },
      { status: 400 }
    );
  }

  // Check if user already has an existing registered profile
  const existingProfile = db.prepare(`
    SELECT id, display_name
    FROM profiles
    WHERE lower(email) = ?
  `).get(email) as { id: string; display_name: string } | undefined;

  if (existingProfile) {
    // Add directly to shop memberships
    db.prepare(`
      INSERT OR REPLACE INTO shop_memberships (shop_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?)
    `).run(shopId, existingProfile.id, role, now);

    // Clean up any lingering invitation
    db.prepare("DELETE FROM shop_invitations WHERE shop_id = ? AND lower(email) = ?").run(shopId, email);

    return NextResponse.json({
      success: true,
      directAdded: true,
      message: `${existingProfile.display_name || email} has been added directly to the team as ${role}.`,
    }, { status: 201 });
  }

  // Otherwise, store in pending invitations
  const inviteId = crypto.randomUUID();
  try {
    db.prepare(`
      INSERT INTO shop_invitations (id, shop_id, email, role, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(shop_id, email) DO UPDATE SET role = excluded.role, created_at = excluded.created_at
    `).run(inviteId, shopId, email, role, now, session.userId);
  } catch (err) {
    return NextResponse.json({ error: "Failed to create invitation." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    directAdded: false,
    message: `Invitation sent to ${email} as ${role}. They will be automatically added when they log in!`,
  }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    shop_id?: unknown;
    user_id?: unknown;
    role?: unknown;
  } | null;

  const shopId = typeof body?.shop_id === "string" ? body.shop_id : "";
  const targetUserId = typeof body?.user_id === "string" ? body.user_id : "";
  const newRole = body?.role === "admin" ? "admin" : body?.role === "staff" ? "staff" : null;

  if (!uuidSchema.safeParse(shopId).success || !uuidSchema.safeParse(targetUserId).success || !newRole) {
    return NextResponse.json({ error: "Valid shop ID, user ID, and target role (admin or staff) are required." }, { status: 400 });
  }

  // Only the shop owner can modify member roles
  const membership = verifyShopMembership(session.userId, shopId);
  if (!membership.authorized || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the shop owner can modify member roles." }, { status: 403 });
  }

  const db = getDb();

  // Protect the owner from being changed
  const targetMembership = db.prepare(`
    SELECT role FROM shop_memberships WHERE shop_id = ? AND user_id = ?
  `).get(shopId, targetUserId) as { role: string } | undefined;

  if (!targetMembership) {
    return NextResponse.json({ error: "Member not found in this shop." }, { status: 404 });
  }

  if (targetMembership.role === "owner") {
    return NextResponse.json({ error: "The shop owner's role cannot be modified." }, { status: 400 });
  }

  db.prepare(`
    UPDATE shop_memberships SET role = ? WHERE shop_id = ? AND user_id = ?
  `).run(newRole, shopId, targetUserId);

  return NextResponse.json({
    success: true,
    message: `Member role updated to ${newRole}.`,
  });
}

export async function DELETE(request: Request) {
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = (await request.json().catch(() => null)) as {
    shop_id?: unknown;
    user_id?: unknown;
    invitation_id?: unknown;
  } | null;

  const shopId = (typeof body?.shop_id === "string" ? body.shop_id : url.searchParams.get("shop_id")) || "";
  const targetUserId = typeof body?.user_id === "string" ? body.user_id : url.searchParams.get("user_id");
  const invitationId = typeof body?.invitation_id === "string" ? body.invitation_id : url.searchParams.get("invitation_id");

  if (!uuidSchema.safeParse(shopId).success) {
    return NextResponse.json({ error: "Valid shop ID is required." }, { status: 400 });
  }

  const membership = verifyShopMembership(session.userId, shopId);
  if (!membership.authorized || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  const db = getDb();

  // Case 1: Cancel pending invitation
  if (invitationId && uuidSchema.safeParse(invitationId).success) {
    db.prepare("DELETE FROM shop_invitations WHERE id = ? AND shop_id = ?").run(invitationId, shopId);
    return NextResponse.json({ success: true, message: "Invitation cancelled." });
  }

  // Case 2: Remove active member
  if (targetUserId && uuidSchema.safeParse(targetUserId).success) {
    const target = db.prepare("SELECT role FROM shop_memberships WHERE shop_id = ? AND user_id = ?").get(shopId, targetUserId) as { role: string } | undefined;

    if (!target) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    if (target.role === "owner") {
      return NextResponse.json({ error: "The shop owner cannot be removed." }, { status: 400 });
    }

    // Admins can only remove staff members; only owners can remove admins
    if (membership.role === "admin" && target.role === "admin") {
      return NextResponse.json({ error: "Only the shop owner can remove other administrators." }, { status: 403 });
    }

    db.prepare("DELETE FROM shop_memberships WHERE shop_id = ? AND user_id = ?").run(shopId, targetUserId);
    return NextResponse.json({ success: true, message: "Member removed from shop." });
  }

  return NextResponse.json({ error: "Specify either user_id or invitation_id to remove." }, { status: 400 });
}
