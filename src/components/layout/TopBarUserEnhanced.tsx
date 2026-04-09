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
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(currentUserId ?? null);
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/profiles")
      .then((response) => response.json())
      .then((data) => setProfiles(data.profiles ?? []))
      .catch(() => setProfiles([]));
  }, [currentUserId]);

  useEffect(() => {
    setSelectedProfileId(currentUserId ?? null);
  }, [currentUserId, open]);

  async function switchRole(role: string) {
    if (role === activeRole || switching) return;
    setSwitching(true);
    setOpen(false);
    try {
      await updateSession({ selectedRole: role });
      window.location.reload();
    } finally {
      setSwitching(false);
    }
  }

  async function switchProfileRole(userId: string, role: string) {
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
  const selectableProfiles = profiles.length > 0
    ? profiles
    : [{ id: currentUserId ?? "current", profileName: "Default", roles }];
  const selectedProfile = selectableProfiles.find((profile) => profile.id === selectedProfileId) ?? currentProfile ?? selectableProfiles[0];
  const selectedProfileIsCurrent = selectedProfile?.id === currentUserId;

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
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Choose a profile first, then choose the role you want to use in that profile.</p>
                  </div>
                </div>
              </div>

              {selectableProfiles.length > 1 ? (
                <div className="border-b border-white/20 px-5 py-4 dark:border-white/10">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">1. Choose profile</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Pick which saved access profile you want to use.</p>
                    </div>
                    <span className="rounded-full border border-white/30 bg-white/35 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">{selectableProfiles.length} profiles</span>
                  </div>
                  <div className="space-y-2">
                    {selectableProfiles.map((profile) => {
                      const isSelected = profile.id === selectedProfile?.id;
                      const isCurrent = profile.id === currentUserId;
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => setSelectedProfileId(profile.id)}
                          disabled={switching}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                            isSelected
                              ? "bg-primary-50 text-primary-800 ring-1 ring-primary-200 dark:bg-primary-950/30 dark:text-primary-200 dark:ring-primary-500/30"
                              : "bg-white/30 text-slate-700 hover:bg-white/50 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                          }`}
                        >
                          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${isSelected ? "border-primary-300 bg-primary-500 text-white dark:border-primary-500" : "border-slate-300 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                            {isSelected ? "OK" : profile.profileName.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{profile.profileName}</p>
                            <p className="text-xs opacity-75">{isCurrent ? "Current saved profile" : "Select this profile to choose a role"}</p>
                          </div>
                          <span className="ml-auto text-xs opacity-70">{profile.roles.length} role{profile.roles.length === 1 ? "" : "s"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {selectedProfile ? (
                <div className="border-b border-white/20 px-5 py-4 dark:border-white/10">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">2. Choose role</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {selectedProfileIsCurrent ? "Select how you want to work in the current profile." : `Choose the role you want to use in ${selectedProfile.profileName}.`}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/30 bg-white/35 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      {selectedProfile.profileName}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectedProfile.roles.map((role, index) => {
                      const isActive = selectedProfileIsCurrent && role === currentRoleKey;
                      return (
                        <button
                          key={`${selectedProfile.id}-${role}`}
                          type="button"
                          onClick={() => (selectedProfileIsCurrent ? switchRole(role) : switchProfileRole(selectedProfile.id, role))}
                          disabled={switching || isActive}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                            isActive
                              ? "bg-primary-50 text-primary-800 ring-1 ring-primary-200 dark:bg-primary-950/30 dark:text-primary-200 dark:ring-primary-500/30"
                              : "bg-white/30 text-slate-700 hover:bg-white/50 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                          }`}
                        >
                          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${isActive ? "border-primary-300 bg-primary-500 text-white dark:border-primary-500" : roleTone(index)}`}>
                            {isActive ? "OK" : roleLabel(role).slice(0, 1)}
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{roleLabel(role)}</p>
                            <p className="text-xs opacity-75">
                              {isActive
                                ? "You are using this role now"
                                : selectedProfileIsCurrent
                                  ? "Use this role in the current profile"
                                  : `Switch to ${selectedProfile.profileName} with this role`}
                            </p>
                          </div>
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
