"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import type { UserRole } from "@/types/db";
import { asRolesArray } from "@/types/db";
import { ROLE_LABELS } from "@/lib/constants";

type ProfileOption = { id: string; profileName: string; roles: string[] };

type TopBarUserProps = {
  userEmail: string | null | undefined;
  userRoles: string[] | null | undefined;
  currentUserId?: string | null;
  activeRole?: string | null;
};

function roleLabel(role: string) {
  return ROLE_LABELS[role as UserRole] ?? role;
}

function roleTone(index: number) {
  const tones = [
    "border-sky-300/60 bg-sky-50/80 text-sky-800 dark:border-sky-500/30 dark:bg-sky-950/30 dark:text-sky-200",
    "border-emerald-300/60 bg-emerald-50/80 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200",
    "border-amber-300/60 bg-amber-50/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200",
    "border-rose-300/60 bg-rose-50/80 text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200",
  ];
  return tones[index % tones.length];
}

export function TopBarUserEnhanced({ userEmail, userRoles, currentUserId, activeRole }: TopBarUserProps) {
  const roles = asRolesArray(userRoles);
  const { update: updateSession } = useSession();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/profiles")
      .then((response) => response.json())
      .then((data) => setProfiles(data.profiles ?? []))
      .catch(() => setProfiles([]));
  }, [currentUserId]);

  async function switchAccess(userId: string, role: string) {
    if (switching) return;
    const currentRole = activeRole || roles[0];
    if (userId === currentUserId && role === currentRole) return;
    setSwitching(true);
    setOpen(false);
    try {
      await updateSession({ selectedUserId: userId, selectedRole: role });
      window.location.reload();
    } finally {
      setSwitching(false);
    }
  }

  const currentRoleKey = activeRole || roles[0];
  const primaryRole = currentRoleKey ? roleLabel(currentRoleKey) : "No role";
  const avatarLabel = useMemo(() => (userEmail?.trim()?.[0] ?? "U").toUpperCase(), [userEmail]);
  const visibleRoles = roles.slice(0, 2);
  const extraRoles = Math.max(roles.length - visibleRoles.length, 0);
  const currentProfile = profiles.find((profile) => profile.id === currentUserId) ?? null;
  const selectableProfiles = profiles.length > 0 ? profiles : [{ id: currentUserId ?? "current", profileName: "Default", roles }];
  const roleCounts = selectableProfiles.reduce<Record<string, number>>((acc, profile) => {
    profile.roles.forEach((role) => {
      acc[role] = (acc[role] ?? 0) + 1;
    });
    return acc;
  }, {});
  const roleOptions = selectableProfiles.flatMap((profile) =>
    profile.roles.map((role) => ({
      id: `${profile.id}:${role}`,
      userId: profile.id,
      role,
      roleName: roleLabel(role),
      profileName: profile.profileName,
      isCurrent: profile.id === currentUserId && role === currentRoleKey,
      showProfileHint: roleCounts[role] > 1 || profile.profileName !== "Default",
    }))
  );

  return (
    <div className="relative flex items-center gap-4">
      <div className="hidden text-right sm:block">
        <p className="max-w-[260px] truncate text-base font-semibold text-slate-800 dark:text-slate-200" title={userEmail ?? undefined}>
          {userEmail ?? "No email"}
        </p>
        <div className="mt-1 flex max-w-[260px] flex-wrap justify-end gap-1.5">
          {visibleRoles.map((role, index) => (
            <span key={role} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${roleTone(index)}`}>
              {roleLabel(role)}
            </span>
          ))}
          {extraRoles > 0 ? (
            <span className="inline-flex items-center rounded-full border border-white/30 bg-white/35 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              +{extraRoles} more
            </span>
          ) : null}
        </div>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((state) => !state)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-200/80 bg-white text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary-300 hover:bg-slate-50 dark:border-slate-600/60 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:bg-slate-700/80"
          aria-label="User menu"
          aria-expanded={open}
          aria-controls="user-menu-dropdown"
        >
          {avatarLabel}
        </button>
        {open ? (
          <>
            <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
            <div id="user-menu-dropdown" className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-3xl border border-white/25 bg-white/95 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95">
              <div className="border-b border-white/20 px-5 py-4 dark:border-white/10">
                  <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-sm font-semibold text-white shadow-lg shadow-primary-500/25">
                    {avatarLabel}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{userEmail ?? "No email"}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Current access: <span className="font-medium text-slate-900 dark:text-slate-100">{currentProfile?.profileName ?? "Default"}</span>{" -> "}<span className="font-medium text-slate-900 dark:text-slate-100">{primaryRole}</span>
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Choose the role you want to use. The correct access profile will switch automatically if needed.</p>
                  </div>
                </div>
              </div>

              {roleOptions.length > 1 ? (
                <div className="border-b border-white/20 px-5 py-4 dark:border-white/10">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Choose role</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Select how you want to work right now.</p>
                    </div>
                    <span className="rounded-full border border-white/30 bg-white/35 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">{roleOptions.length} options</span>
                  </div>
                  <div className="space-y-2" role="radiogroup" aria-label="Choose active role">
                    {roleOptions.map((option, index) => {
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={option.isCurrent}
                          onClick={() => switchAccess(option.userId, option.role)}
                          disabled={switching || option.isCurrent}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                            option.isCurrent
                              ? "bg-primary-50 text-primary-800 ring-1 ring-primary-200 dark:bg-primary-950/30 dark:text-primary-200 dark:ring-primary-500/30"
                              : "bg-white/30 text-slate-700 hover:bg-white/50 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                          }`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${option.isCurrent ? "border-primary-500 bg-primary-500" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"}`}>
                            {option.isCurrent ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{option.roleName}</p>
                            <p className="text-xs opacity-75">
                              {option.isCurrent
                                ? "You are using this role now"
                                : option.showProfileHint
                                  ? `Uses profile: ${option.profileName}`
                                  : "Switch to this role"}
                            </p>
                          </div>
                          {!option.isCurrent && option.showProfileHint ? (
                            <span className={`ml-auto rounded-full border px-2 py-1 text-[11px] font-medium ${roleTone(index)}`}>
                              {option.profileName}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="p-3">
                <Link
                  href="/api/auth/signout"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/30 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white/50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
                  onClick={() => setOpen(false)}
                >
                  Sign out
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
