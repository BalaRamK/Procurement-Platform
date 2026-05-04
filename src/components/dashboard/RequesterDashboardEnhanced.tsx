"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Ticket, User } from "@/types/db";
import { STATUS_LABELS } from "@/lib/constants";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DashboardHero, EmptyDashboardState, MetricTile, formatShortDate } from "./DashboardShared";

type TicketWithRequester = Ticket & { requester?: User };

const COMPLETED_STATUSES = new Set(["CLOSED", "REJECTED", "CONFIRMED_BY_REQUESTER"]);

function ticketDateValue(value: unknown) {
  const time = value ? new Date(value as string | Date).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function uniqueValues(tickets: TicketWithRequester[], key: "teamName" | "priority" | "status") {
  return Array.from(new Set(tickets.map((ticket) => ticket[key]).filter(Boolean) as string[])).sort();
}

function RequestTable({
  tickets,
  title,
  emptyTitle,
  emptyDescription,
  showAll,
  showButton,
}: {
  tickets: TicketWithRequester[];
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  showAll: boolean;
  showButton: boolean;
}) {
  const colSpan = showAll ? 9 : 8;

  return (
    <div className="card overflow-hidden">
      <div className="card-header px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/20 dark:divide-white/10">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">ID</th>
              <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Title</th>
              {showAll ? <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Requester</th> : null}
              <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Team</th>
              <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Status</th>
              <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Priority</th>
              <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Created</th>
              <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Updated</th>
              <th scope="col" className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/20 bg-white/25 dark:bg-white/5">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-0">
                  <EmptyDashboardState
                    title={emptyTitle}
                    description={emptyDescription}
                    actionHref={showButton ? "/requests/new" : undefined}
                    actionLabel={showButton ? "Create a request" : undefined}
                  />
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} className="table-row-glass transition-colors">
                  <td className="px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">{ticket.requestId ?? "-"}</td>
                  <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{ticket.title}</td>
                  {showAll ? <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{ticket.requester?.email ?? ticket.requesterName ?? "-"}</td> : null}
                  <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{ticket.teamName}</td>
                  <td className="px-5 py-4"><StatusBadge status={ticket.status} /></td>
                  <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{String(ticket.priority ?? "-")}</td>
                  <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-300">{formatShortDate(ticket.createdAt as string | Date)}</td>
                  <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-300">{formatShortDate(ticket.updatedAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/requests/${ticket.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-sky-200 dark:hover:text-white">
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RequesterDashboardEnhanced({
  tickets,
  showAll = false,
  title,
  subtitle,
  showNewRequestButton,
}: {
  tickets: TicketWithRequester[];
  showAll?: boolean;
  title?: string;
  subtitle?: string;
  showNewRequestButton?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [sortMode, setSortMode] = useState<"createdDesc" | "statusThenDate">("createdDesc");

  const heading = title ?? (showAll ? "All requests" : "My requests");
  const sub = subtitle ?? (showAll ? "Browse the full procurement queue across teams." : "Track what you have raised and what still needs your attention.");
  const showButton = showNewRequestButton ?? !showAll;

  const activeBase = useMemo(
    () => tickets.filter((ticket) => !COMPLETED_STATUSES.has(ticket.status)),
    [tickets]
  );
  const completedTickets = useMemo(
    () => tickets
      .filter((ticket) => COMPLETED_STATUSES.has(ticket.status))
      .sort((a, b) => ticketDateValue(b.createdAt) - ticketDateValue(a.createdAt)),
    [tickets]
  );

  const activeTickets = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const fromTime = createdFrom ? new Date(`${createdFrom}T00:00:00`).getTime() : null;
    const toTime = createdTo ? new Date(`${createdTo}T23:59:59`).getTime() : null;

    return activeBase
      .filter((ticket) => {
        const createdTime = ticketDateValue(ticket.createdAt);
        const haystack = [
          ticket.requestId,
          ticket.title,
          ticket.requesterName,
          ticket.requester?.email,
          ticket.teamName,
          STATUS_LABELS[ticket.status] ?? ticket.status,
        ].filter(Boolean).join(" ").toLowerCase();
        return (
          (!searchLower || haystack.includes(searchLower)) &&
          (!statusFilter || ticket.status === statusFilter) &&
          (!teamFilter || ticket.teamName === teamFilter) &&
          (!priorityFilter || ticket.priority === priorityFilter) &&
          (fromTime === null || createdTime >= fromTime) &&
          (toTime === null || createdTime <= toTime)
        );
      })
      .sort((a, b) => {
        if (sortMode === "statusThenDate") {
          const statusCompare = (STATUS_LABELS[a.status] ?? a.status).localeCompare(STATUS_LABELS[b.status] ?? b.status);
          if (statusCompare !== 0) return statusCompare;
        }
        return ticketDateValue(b.createdAt) - ticketDateValue(a.createdAt);
      });
  }, [activeBase, createdFrom, createdTo, priorityFilter, search, sortMode, statusFilter, teamFilter]);

  const activeStatuses = uniqueValues(activeBase, "status");
  const teams = uniqueValues(activeBase, "teamName");
  const priorities = uniqueValues(activeBase, "priority");
  const waitingConfirm = activeBase.filter((ticket) => ticket.status === "DELIVERED_TO_REQUESTER").length;
  const recentCreated = tickets.length > 0
    ? formatShortDate([...tickets].sort((a, b) => ticketDateValue(b.createdAt) - ticketDateValue(a.createdAt))[0].createdAt as string | Date)
    : "-";

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow={showAll ? "Operations view" : "Requester workspace"}
        title={heading}
        description={sub}
        action={
          showButton ? (
            <Link href="/requests/new" className="btn-primary flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New request
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile label="Active requests" value={activeBase.length} hint="Requests still moving through the process." tone="warning" />
        <MetricTile label="Completed / rejected" value={completedTickets.length} hint="Closed, confirmed, or rejected requests." tone="info" />
        <MetricTile label="Latest created" value={recentCreated} hint="Newest request in this view." tone="default" />
      </div>

      {waitingConfirm > 0 ? (
        <div className="rounded-3xl border border-amber-300/40 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-200">
          {waitingConfirm} request{waitingConfirm === 1 ? "" : "s"} are waiting for requester confirmation.
        </div>
      ) : null}

      <section className="card p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Active request filters</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Filter active work by status, date, team, priority, or keyword.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setTeamFilter("");
              setPriorityFilter("");
              setCreatedFrom("");
              setCreatedTo("");
              setSortMode("createdDesc");
            }}
            className="btn-secondary py-2 text-sm"
          >
            Reset filters
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input-base xl:col-span-2"
            placeholder="Search ID, title, requester"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input-base">
            <option value="">All statuses</option>
            {activeStatuses.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status] ?? status}</option>
            ))}
          </select>
          <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="input-base">
            <option value="">All teams</option>
            {teams.map((team) => <option key={team} value={team}>{team}</option>)}
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="input-base">
            <option value="">All priorities</option>
            {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
          <input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} className="input-base" aria-label="Created from" />
          <input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} className="input-base" aria-label="Created to" />
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as "createdDesc" | "statusThenDate")} className="input-base xl:col-span-2">
            <option value="createdDesc">Newest created first</option>
            <option value="statusThenDate">Status, then newest created</option>
          </select>
        </div>
      </section>

      <RequestTable
        tickets={activeTickets}
        title={`Active Requests (${activeTickets.length})`}
        emptyTitle="No active requests match the current filters."
        emptyDescription={activeBase.length === 0 ? "Active requests will appear here after submission." : "Try changing or resetting the filters above."}
        showAll={showAll}
        showButton={showButton && activeBase.length === 0}
      />

      <RequestTable
        tickets={completedTickets}
        title={`Completed / Rejected Requests (${completedTickets.length})`}
        emptyTitle="No completed or rejected requests yet."
        emptyDescription="Closed, confirmed, and rejected requests will move here so active work stays focused."
        showAll={showAll}
        showButton={false}
      />
    </div>
  );
}
