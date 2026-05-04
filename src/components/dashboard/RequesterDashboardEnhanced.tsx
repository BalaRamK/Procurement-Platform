"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Ticket, User } from "@/types/db";
import { STATUS_LABELS } from "@/lib/constants";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DashboardHero, EmptyDashboardState, MetricTile, formatShortDate } from "./DashboardShared";

type TicketWithRequester = Ticket & { requester?: User };
type SortKey = "requestId" | "title" | "requester" | "teamName" | "status" | "priority" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";

const COMPLETED_STATUSES = new Set(["CLOSED", "REJECTED"]);

function ticketDateValue(value: unknown) {
  const time = value ? new Date(value as string | Date).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function uniqueValues(tickets: TicketWithRequester[], key: "teamName" | "priority" | "status") {
  return Array.from(new Set(tickets.map((ticket) => ticket[key]).filter(Boolean) as string[])).sort();
}

function sortValue(ticket: TicketWithRequester, key: SortKey) {
  if (key === "createdAt" || key === "updatedAt") return ticketDateValue(ticket[key]);
  if (key === "requester") return String(ticket.requester?.email ?? ticket.requesterName ?? "").toLowerCase();
  if (key === "status") return String(STATUS_LABELS[ticket.status] ?? ticket.status).toLowerCase();
  return String(ticket[key] ?? "").toLowerCase();
}

function sortTickets(tickets: TicketWithRequester[], key: SortKey, direction: SortDirection) {
  return [...tickets].sort((a, b) => {
    const aValue = sortValue(a, key);
    const bValue = sortValue(b, key);
    const compare = typeof aValue === "number" && typeof bValue === "number"
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue));
    return direction === "asc" ? compare : -compare;
  });
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  align = "left",
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  align?: "left" | "right";
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  const arrow = active ? (direction === "asc" ? "↑" : "↓") : "↕";
  return (
    <th scope="col" className={`card-header px-5 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition ${
          active ? "text-primary-700 dark:text-sky-200" : "text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
        }`}
        aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <span aria-hidden="true" className="text-[11px]">{arrow}</span>
      </button>
    </th>
  );
}

function RequestTable({
  tickets,
  title,
  emptyTitle,
  emptyDescription,
  showAll,
  showButton,
  sortKey,
  sortDirection,
  onSort,
}: {
  tickets: TicketWithRequester[];
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  showAll: boolean;
  showButton: boolean;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
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
              <SortHeader label="ID" sortKey="requestId" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
              <SortHeader label="Title" sortKey="title" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
              {showAll ? <SortHeader label="Requester" sortKey="requester" activeKey={sortKey} direction={sortDirection} onSort={onSort} /> : null}
              <SortHeader label="Team" sortKey="teamName" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
              <SortHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
              <SortHeader label="Priority" sortKey="priority" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
              <SortHeader label="Created" sortKey="createdAt" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
              <SortHeader label="Updated" sortKey="updatedAt" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
              <th scope="col" className="card-header px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Actions</th>
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
  const [statusFilter, setStatusFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [activeSortKey, setActiveSortKey] = useState<SortKey>("createdAt");
  const [activeSortDirection, setActiveSortDirection] = useState<SortDirection>("desc");
  const [completedSortKey, setCompletedSortKey] = useState<SortKey>("createdAt");
  const [completedSortDirection, setCompletedSortDirection] = useState<SortDirection>("desc");

  const heading = title ?? (showAll ? "All requests" : "My requests");
  const sub = subtitle ?? (showAll ? "Browse the full procurement queue across teams." : "Track what you have raised and what still needs your attention.");
  const showButton = showNewRequestButton ?? !showAll;

  const activeBase = useMemo(
    () => tickets.filter((ticket) => !COMPLETED_STATUSES.has(ticket.status)),
    [tickets]
  );
  const completedTickets = useMemo(
    () => sortTickets(
      tickets.filter((ticket) => COMPLETED_STATUSES.has(ticket.status)),
      completedSortKey,
      completedSortDirection
    ),
    [completedSortDirection, completedSortKey, tickets]
  );

  const activeTickets = useMemo(() => {
    const filtered = activeBase
      .filter((ticket) => {
        return (
          (!statusFilter || ticket.status === statusFilter) &&
          (!teamFilter || ticket.teamName === teamFilter) &&
          (!priorityFilter || ticket.priority === priorityFilter)
        );
      });
    return sortTickets(filtered, activeSortKey, activeSortDirection);
  }, [activeBase, activeSortDirection, activeSortKey, priorityFilter, statusFilter, teamFilter]);

  const activeStatuses = uniqueValues(activeBase, "status");
  const teams = uniqueValues(activeBase, "teamName");
  const priorities = uniqueValues(activeBase, "priority");
  const waitingConfirm = activeBase.filter((ticket) => ticket.status === "DELIVERED_TO_REQUESTER").length;
  const recentCreated = tickets.length > 0
    ? formatShortDate([...tickets].sort((a, b) => ticketDateValue(b.createdAt) - ticketDateValue(a.createdAt))[0].createdAt as string | Date)
    : "-";
  const toggleActiveSort = (key: SortKey) => {
    if (key === activeSortKey) {
      setActiveSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setActiveSortKey(key);
    setActiveSortDirection(key === "createdAt" || key === "updatedAt" ? "desc" : "asc");
  };
  const toggleCompletedSort = (key: SortKey) => {
    if (key === completedSortKey) {
      setCompletedSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setCompletedSortKey(key);
    setCompletedSortDirection(key === "createdAt" || key === "updatedAt" ? "desc" : "asc");
  };

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

      <section className="card px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Active request filters</h2>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              setTeamFilter("");
              setPriorityFilter("");
            }}
            className="self-start rounded-xl border border-white/30 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white/40 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white lg:order-last"
          >
            Reset
          </button>
          <div className="grid flex-1 gap-2 sm:grid-cols-3">
            <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="input-base min-h-0 rounded-xl py-2 text-sm">
              <option value="">All teams</option>
              {teams.map((team) => <option key={team} value={team}>{team}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input-base min-h-0 rounded-xl py-2 text-sm">
              <option value="">All statuses</option>
              {activeStatuses.map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status] ?? status}</option>
              ))}
            </select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="input-base min-h-0 rounded-xl py-2 text-sm">
              <option value="">All priorities</option>
              {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </div>
        </div>
      </section>

      <RequestTable
        tickets={activeTickets}
        title={`Active Requests (${activeTickets.length})`}
        emptyTitle="No active requests match the current filters."
        emptyDescription={activeBase.length === 0 ? "Active requests will appear here after submission." : "Try changing or resetting the filters above."}
        showAll={showAll}
        showButton={showButton && activeBase.length === 0}
        sortKey={activeSortKey}
        sortDirection={activeSortDirection}
        onSort={toggleActiveSort}
      />

      <RequestTable
        tickets={completedTickets}
        title={`Completed / Rejected Requests (${completedTickets.length})`}
        emptyTitle="No completed or rejected requests yet."
        emptyDescription="Closed, confirmed, and rejected requests will move here so active work stays focused."
        showAll={showAll}
        showButton={false}
        sortKey={completedSortKey}
        sortDirection={completedSortDirection}
        onSort={toggleCompletedSort}
      />
    </div>
  );
}
