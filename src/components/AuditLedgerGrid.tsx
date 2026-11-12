"use client";

import React, { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ColDef,
  ICellRendererParams,
  ModuleRegistry,
  colorSchemeDark,
  themeQuartz,
} from "ag-grid-community";
import { AuditTransaction } from "@/data/catalog";

ModuleRegistry.registerModules([AllCommunityModule]);

const darkTvGridTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: "#090f1e",
  foregroundColor: "#e2e8f0",
  headerBackgroundColor: "#0f172a",
  borderColor: "#1e293b",
  rowHoverColor: "#16223a",
  fontSize: 12,
});

interface AuditLedgerGridProps {
  transactions: AuditTransaction[];
}

function ModeCellRenderer(params: ICellRendererParams<AuditTransaction>) {
  const mode = params.value as AuditTransaction["mode"] | undefined;
  if (mode === "ghostpass") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
        GhostPass
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Standard Bot
    </span>
  );
}

function VerdictCellRenderer(params: ICellRendererParams<AuditTransaction>) {
  const verdict = params.value as AuditTransaction["verdict"] | undefined;
  const styles: Record<string, string> = {
    APPROVED: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    BLOCKED: "border-rose-500/40 bg-rose-500/15 text-rose-300",
    "403_REJECTED": "border-rose-500/40 bg-rose-500/15 text-rose-300",
    NEEDS_APPROVAL: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  };
  const labels: Record<string, string> = {
    APPROVED: "APPROVED ✓",
    BLOCKED: "THREAT BLOCKED",
    "403_REJECTED": "403 BOT BLOCK",
    NEEDS_APPROVAL: "NEEDS TAP",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        styles[verdict ?? ""] ?? "border-slate-600 bg-slate-800 text-slate-300"
      }`}
    >
      {labels[verdict ?? ""] ?? verdict}
    </span>
  );
}

function PiiCellRenderer(params: ICellRendererParams<AuditTransaction>) {
  const pct = Number(params.value ?? 0);
  const safe = pct === 0;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold ${
        safe
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
          : "border-rose-500/40 bg-rose-500/15 text-rose-300"
      }`}
    >
      {pct}% PII
    </span>
  );
}

export function AuditLedgerGrid({ transactions }: AuditLedgerGridProps) {
  const columnDefs = useMemo<ColDef<AuditTransaction>[]>(
    () => [
      {
        headerName: "Time (UTC)",
        field: "timestamp",
        width: 115,
        valueFormatter: (p) => {
          if (!p.value) return "";
          const d = new Date(String(p.value));
          return Number.isNaN(d.getTime())
            ? String(p.value)
            : d.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZone: "UTC",
                hour12: false,
              });
        },
      },
      {
        headerName: "Mode",
        field: "mode",
        width: 135,
        cellRenderer: ModeCellRenderer,
      },
      {
        headerName: "Requested Item",
        field: "requestedProductName",
        minWidth: 200,
        flex: 1,
      },
      {
        headerName: "Amount",
        field: "totalAmount",
        width: 100,
        valueFormatter: (p) => `$${Number(p.value ?? 0).toFixed(2)}`,
      },
      {
        headerName: "Verdict",
        field: "verdict",
        width: 145,
        cellRenderer: VerdictCellRenderer,
      },
      {
        headerName: "Risk",
        field: "riskScore",
        width: 85,
        valueFormatter: (p) => `${p.value ?? 0}/100`,
      },
      {
        headerName: "PII Leaked",
        field: "piiExposedPct",
        width: 105,
        cellRenderer: PiiCellRenderer,
      },
      {
        headerName: "PayPal Order ID",
        field: "paypalOrderId",
        width: 175,
        valueFormatter: (p) => (p.value ? String(p.value) : "— ($0 Moved)"),
      },
      {
        headerName: "Gatekeeper / Store Reason",
        field: "reason",
        minWidth: 260,
        flex: 1.4,
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef<AuditTransaction>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
    }),
    []
  );

  if (transactions.length === 0) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/70 text-center">
        <p className="text-sm font-medium text-slate-300">
          No audit events recorded yet.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Run any scenario in the AI Shopping Bar below to watch live GhostPass
          telemetry populate here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[340px] w-full overflow-hidden rounded-2xl border border-slate-800">
      <AgGridReact<AuditTransaction>
        theme={darkTvGridTheme}
        rowData={transactions}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        animateRows={true}
        pagination={true}
        paginationPageSize={8}
        getRowId={(params) => params.data.id}
      />
    </div>
  );
}
