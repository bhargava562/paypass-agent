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
    headerTextColor: "#18181B",
    headerFontSize: 12,
    headerFontWeight: 700,
    borderColor: "#E4E4E7",
    rowHoverColor: "#F4F4F5",
    cellHorizontalPadding: 14,
    fontSize: 12,
    rowHeight: 38,
    headerHeight: 36,
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
      <div className="flex h-full items-center">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#0070E0]/30 bg-[#0070E0]/10 px-2.5 py-1 text-[11px] font-semibold leading-none text-[#003087]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0070E0]" />
          PayPal Guardrail
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-full items-center">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-[11px] font-medium leading-none text-zinc-700">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
        Unverified Agent
      </span>
    </div>
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
    BLOCKED: "INJECTION BLOCKED",
    "403_REJECTED": "403 SCRAPER BLOCK",
    NEEDS_APPROVAL: "HITL REQUIRED",
  };
  return (
    <div className="flex h-full items-center">
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold leading-none tracking-tight ${
          styles[verdict ?? ""] ?? "border-zinc-200 bg-zinc-100 text-zinc-700"
        }`}
      >
        {labels[verdict ?? ""] ?? verdict}
      </span>
    </div>
  );
}

function PiiCellRenderer(params: ICellRendererParams<AuditTransaction>) {
  const pct = Number(params.value ?? 0);
  const safe = pct === 0;
  return (
    <div className="flex h-full items-center">
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold leading-none ${
          safe
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}
      >
        {pct}%
      </span>
    </div>
  );
}

function PayPalOrderCellRenderer(params: ICellRendererParams<AuditTransaction>) {
  const orderId = params.value as string | null | undefined;
  if (!orderId) {
    return (
      <div className="flex h-full items-center">
        <span className="font-mono text-xs text-zinc-500">—</span>
      </div>
    );
  }
  if (!isRealPayPalOrderId(orderId)) {
    return (
      <div className="flex h-full items-center">
        <span className="whitespace-nowrap font-mono text-xs font-semibold text-zinc-700">
          {orderId}
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-full items-center">
      <a
        href={`https://www.sandbox.paypal.com/activity/payment/${encodeURIComponent(orderId)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded font-mono text-xs font-semibold text-[#005BB5] transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070E0]"
      >
        <span>{orderId}</span>
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="sr-only">(opens PayPal Sandbox in new tab)</span>
      </a>
    </div>
  );
}

export function AuditLedgerGrid({ transactions }: AuditLedgerGridProps) {
  const columnDefs = useMemo<ColDef<AuditTransaction>[]>(
    () => [
      {
        headerName: "Timestamp",
        field: "timestamp",
        minWidth: 96,
        flex: 0.7,
        cellClass: "font-mono text-zinc-600",
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
        minWidth: 160,
        flex: 1.05,
        cellRenderer: ModeCellRenderer,
      },
      {
        headerName: "Merchant & Item",
        field: "requestedProductName",
        minWidth: 210,
        flex: 1.85,
        tooltipField: "reason",
        valueFormatter: (p) => {
          const val = String(p.value ?? "");
          if (!val) return "NovaTech Store";
          return p.data?.requestedProductId?.startsWith("custom-")
            ? `Custom · ${val}`
            : `NovaTech · ${val}`;
        },
      },
      {
        headerName: "Amount",
        field: "totalAmount",
        minWidth: 92,
        flex: 0.7,
        cellClass: "font-mono font-semibold text-[#09090B]",
        valueFormatter: (p) => `$${Number(p.value ?? 0).toFixed(2)}`,
      },
      {
        headerName: "Verdict",
        field: "verdict",
        minWidth: 168,
        flex: 1.15,
        cellRenderer: VerdictCellRenderer,
      },
      {
        headerName: "PII Leaked",
        field: "piiExposedPct",
        minWidth: 96,
        flex: 0.7,
        cellRenderer: PiiCellRenderer,
      },
      {
        headerName: "PayPal Order ID",
        field: "paypalOrderId",
        minWidth: 185,
        flex: 1.35,
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
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-zinc-50/70">
        <span className="font-mono text-xs text-zinc-600">
          No transactions yet
        </span>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Transaction Ledger"
      className="h-[280px] w-full overflow-hidden rounded-xl border border-[#E4E4E7]"
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
