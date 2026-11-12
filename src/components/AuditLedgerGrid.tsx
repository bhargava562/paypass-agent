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

const compactFintechGridTheme = themeQuartz
  .withPart(colorSchemeLight)
  .withParams({
    backgroundColor: "#FFFFFF",
    foregroundColor: "#09090B",
    headerBackgroundColor: "#FAFAFA",
    borderColor: "#E4E4E7",
    rowHoverColor: "#F4F4F5",
    fontSize: 12,
    rowHeight: 36,
    headerHeight: 34,
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
      Unverified
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
    APPROVED: "SETTLED",
    BLOCKED: "BLOCKED",
    "403_REJECTED": "403 BLOCK",
    NEEDS_APPROVAL: "PENDING",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${
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
      {pct}%
    </span>
  );
}

function PayPalOrderCellRenderer(params: ICellRendererParams<AuditTransaction>) {
  const orderId = params.value as string | null | undefined;
  if (!orderId) {
    return <span className="font-mono text-xs text-zinc-400">—</span>;
  }
  if (!isRealPayPalOrderId(orderId)) {
    return (
      <span className="font-mono text-xs font-semibold text-zinc-700">
        {orderId}
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
        headerName: "Time",
        field: "timestamp",
        minWidth: 68,
        flex: 0.72,
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
        minWidth: 96,
        flex: 0.95,
        cellRenderer: ModeCellRenderer,
      },
      {
        headerName: "Item",
        field: "requestedProductName",
        minWidth: 112,
        flex: 1.35,
        tooltipField: "reason",
      },
      {
        headerName: "Amount",
        field: "totalAmount",
        minWidth: 72,
        flex: 0.78,
        cellClass: "font-mono font-semibold",
        valueFormatter: (p) => `$${Number(p.value ?? 0).toFixed(2)}`,
      },
      {
        headerName: "Status",
        field: "verdict",
        minWidth: 90,
        flex: 0.9,
        cellRenderer: VerdictCellRenderer,
      },
      {
        headerName: "PII Leaked",
        field: "piiExposedPct",
        minWidth: 78,
        flex: 0.78,
        cellRenderer: PiiCellRenderer,
      },
      {
        headerName: "PayPal Order ID",
        field: "paypalOrderId",
        minWidth: 152,
        flex: 1.45,
        cellRenderer: PayPalOrderCellRenderer,
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
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/70">
        <span className="font-mono text-xs text-zinc-500">
          No transactions yet
        </span>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Transaction Ledger"
      className="h-[260px] w-full overflow-hidden rounded-xl border border-zinc-200"
    >
      <AgGridReact<AuditTransaction>
        theme={compactFintechGridTheme}
        rowData={transactions}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        animateRows={true}
        pagination={true}
        paginationPageSize={6}
        paginationPageSizeSelector={[6, 15, 30]}
        getRowId={(params) => params.data.id}
      />
    </div>
  );
}
