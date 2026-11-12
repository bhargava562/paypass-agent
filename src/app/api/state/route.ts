import { NextResponse, connection } from "next/server";
import { AuditTransaction, SpendingMandate } from "@/data/catalog";
import {
  appendTransaction,
  getMandate,
  getStorageBackendMode,
  listTransactions,
  resetDemoState,
  saveMandate,
  updateTransaction,
} from "@/lib/db";

export async function GET() {
  await connection();
  try {
    const [mandate, transactions] = await Promise.all([
      getMandate(),
      listTransactions(),
    ]);
    return NextResponse.json({
      backend: getStorageBackendMode(),
      mandate,
      transactions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as
      | { action: "save_mandate"; mandate: SpendingMandate }
      | { action: "append_tx"; tx: AuditTransaction }
      | {
          action: "update_tx";
          txId: string;
          patch: Partial<AuditTransaction>;
        }
      | { action: "reset" };

    if (body.action === "save_mandate") {
      const mandate = await saveMandate(body.mandate);
      return NextResponse.json({ backend: getStorageBackendMode(), mandate });
    }

    if (body.action === "append_tx") {
      const transactions = await appendTransaction(body.tx);
      return NextResponse.json({
        backend: getStorageBackendMode(),
        transactions,
      });
    }

    if (body.action === "update_tx") {
      const transactions = await updateTransaction(body.txId, body.patch);
      return NextResponse.json({
        backend: getStorageBackendMode(),
        transactions,
      });
    }

    if (body.action === "reset") {
      const state = await resetDemoState();
      return NextResponse.json({
        backend: getStorageBackendMode(),
        ...state,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to persist state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
