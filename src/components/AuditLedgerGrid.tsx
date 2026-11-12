"use client";

import React, { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ColDef,
  ICellRendererParams,
  ModuleRegistry,
  colorSchemeLight,
  themeQuartz,
} from "ag-grid-community";
import { ExternalLink } from "lucide-react";
import { AuditTransaction } from "@/data/catalog";

ModuleRegistry.registerModules([AllCommunityModule]);

const cleanControlPlaneGridTheme = themeQuartz
  .withPart(colorSchemeLight)
  .withParams({
    backgroundColor: "#FFFFFF",
    foregroundColor: "#09090B",
    headerBackgroundColor: "#FAFAFA",
    borderColor: "#E4E4E7",
    rowHoverColor: "#F4F4F5",
    fontSize: 12,
  });

interface AuditLedgerGridProps {
  transactions: AuditTransaction[];
}

function isRealPayPalOrderId(orderId: string): boolean {
  return (
    !orderId.startsWith("SBX-GP-") &&
    !orderId.startsWith("NT-HUMAN-") &&
    !orderId.startsWith("NT-PAY-") &&
    !orderId.startsWith("NT-CRD-")
  );
}

function ModeCellRenderer(params: ICellRendererParams<AuditTransaction>) {
  const mode = params.value as AuditTransaction["mode"] | undefined;
  if (mode === "ghostpass") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0070E0]/30 bg-[#0070E0]/10 px-2 py-0.5 text-[11px] font-semibold text-[#003087]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#0070E0]" />
        GhostPass
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      Unverified Bot
    </span>
  );
}

function VerdictCellRenderer(params: ICellRendererParams<AuditTransaction>) {
  const verdict = params.value as AuditTransaction["verdict"] | undefined;
  const styles: Record<string, string> = {
    APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
    BLOCKED: "border-rose-200 bg-rose-50 text-rose-800",
    "403_REJECTED": "border-rose-200 bg-rose-50 text-rose-800",
    NEEDS_APPROVAL: "border-amber-200 bg-amber-50 text-amber-800",
  };
  const labels: Record<string, string> = {
    APPROVED: "AUTHORIZED",
    BLOCKED: "SCAM BLOCKED",
    "403_REJECTED": "403 BOT BLOCK",
    NEEDS_APPROVAL: "NEEDS APPROVAL",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        styles[verdict ?? ""] ?? "border-zinc-200 bg-zinc-100 text-zinc-700"
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
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {pct}% PII
    </span>
  );
}

function PayPalOrderCellRenderer(params: ICellRendererParams<AuditTransaction>) {
  const orderId = params.value as string | null | undefined;
  if (!orderId) {
    return <span className="font-mono text-xs text-zinc-500">— ($0 Moved)</span>;
  }
  if (!isRealPayPalOrderId(orderId)) {
    return (
      <span className="font-mono text-xs font-semibold text-zinc-700">
        {orderId} (Sim)
      </span>
    );
  }
  return (
    <a
      href={`https://www.sandbox.paypal.com/activity/payment/${encodeURIComponent(orderId)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#005BB5] hover:underline"
    >
      <span>{orderId}</span>
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">(opens PayPal Sandbox in new tab)</span>
    </a>
  );
}

export function AuditLedgerGrid({ transactions }: AuditLedgerGridProps) {
  const columnDefs = useMemo<ColDef<AuditTransaction>[]>(
    () => [
      {
        headerName: "Time (UTC)",
        field: "timestamp",
        width: 110,
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
        headerName: "Agent Mode",
        field: "mode",
        width: 145,
        cellRenderer: ModeCellRenderer,
      },
      {
        headerName: "Requested Item",
        field: "requestedProductName",
        minWidth: 210,
        flex: 1,
      },
      {
        headerName: "Amount",
        field: "totalAmount",
        width: 100,
        valueFormatter: (p) => `$${Number(p.value ?? 0).toFixed(2)}`,
      },
      {
        headerName: "Status",
        field: "verdict",
        width: 150,
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
        headerName: "PayPal Sandbox Order ID",
        field: "paypalOrderId",
        width: 195,
        cellRenderer: PayPalOrderCellRenderer,
      },
      {
        headerName: "Authorization & Audit Reason",
        field: "reason",
        minWidth: 270,
        flex: 1.5,
        tooltipField: "reason",
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
      <div className="flex h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 text-center">
        <p className="text-sm font-semibold text-zinc-800">
          No audit events recorded yet
        </p>
        <p className="mt-1 max-w-md text-xs text-zinc-500">
          Run any scenario in the Agent Sandbox Runner above to inspect live
          authorization checks, blocked injections, and PayPal Sandbox Order IDs.
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Compliance and Audit Ledger Table"
      className="h-[340px] w-full overflow-hidden rounded-2xl border border-zinc-200"
    >
      <AgGridReact<AuditTransaction>
        theme={cleanControlPlaneGridTheme}
        rowData={transactions}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        animateRows={true}
        pagination={true}
        paginationPageSize={8}
        paginationPageSizeSelector={[8, 20, 50]}
        getRowId={(params) => params.data.id}
      />
    </div>
  );
}
