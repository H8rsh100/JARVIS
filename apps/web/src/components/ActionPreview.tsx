"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  useEstimateGas,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useDeployContract,
} from "wagmi";
import { useEffect, useMemo, useState } from "react";
import type { UnsignedIntent } from "@jarvis/agent";
import { chainByKey } from "@jarvis/chains";
import type { Hex } from "viem";

type Props = {
  intent: UnsignedIntent | null;
  spendCap: string;
  onClear: () => void;
  onResolved: (result: {
    status: "confirmed" | "rejected" | "error";
    txHash?: string;
    error?: string;
  }) => void;
};

export function ActionPreview({ intent, spendCap, onClear, onResolved }: Props) {
  const { switchChainAsync } = useSwitchChain();
  const {
    sendTransactionAsync,
    data: sendHash,
    reset: resetSend,
    error: sendError,
  } = useSendTransaction();
  const {
    deployContractAsync,
    data: deployHash,
    reset: resetDeploy,
    error: deployError,
  } = useDeployContract();

  const [submitting, setSubmitting] = useState(false);
  const pendingHash = sendHash || deployHash;

  const estimateInput = useMemo(() => {
    if (!intent) return undefined;
    if (intent.kind === "deploy") return undefined;
    if (!intent.to) return undefined;
    return {
      to: intent.to,
      value: intent.valueWei ? BigInt(intent.valueWei) : 0n,
      data: (intent.data as Hex | undefined) || undefined,
      chainId: intent.chainId,
    };
  }, [intent]);

  const { data: gasEstimate, error: gasError } = useEstimateGas(estimateInput);

  const { isSuccess, isError, error: receiptError } = useWaitForTransactionReceipt({
    hash: pendingHash,
  });

  const overCap = useMemo(() => {
    if (!intent?.nativeAmount) return false;
    const amt = Number(intent.nativeAmount);
    const cap = Number(spendCap);
    return Number.isFinite(amt) && Number.isFinite(cap) && amt > cap;
  }, [intent, spendCap]);

  useEffect(() => {
    if (!pendingHash) return;
    if (isSuccess) {
      onResolved({ status: "confirmed", txHash: pendingHash });
      resetSend();
      resetDeploy();
      setSubmitting(false);
    } else if (isError) {
      onResolved({
        status: "error",
        error: receiptError?.message || "Transaction failed",
      });
      setSubmitting(false);
    }
  }, [
    isSuccess,
    isError,
    pendingHash,
    receiptError,
    onResolved,
    resetSend,
    resetDeploy,
  ]);

  useEffect(() => {
    const err = sendError || deployError;
    if (err && submitting) {
      const msg = err.message || "Wallet error";
      if (/user rejected|denied/i.test(msg)) {
        onResolved({ status: "rejected" });
      } else {
        onResolved({ status: "error", error: msg });
      }
      setSubmitting(false);
    }
  }, [sendError, deployError, submitting, onResolved]);

  async function confirm() {
    if (!intent) return;
    setSubmitting(true);
    try {
      await switchChainAsync({ chainId: intent.chainId });

      if (intent.kind === "transfer" || intent.kind === "swap" || intent.kind === "token_transfer") {
        await sendTransactionAsync({
          to: intent.to,
          value: intent.valueWei ? BigInt(intent.valueWei) : 0n,
          data: intent.data as Hex | undefined,
          chainId: intent.chainId,
        });
      } else if (intent.kind === "deploy") {
        if (!intent.bytecode || !intent.abi) {
          throw new Error("Missing deploy bytecode");
        }
        await deployContractAsync({
          abi: intent.abi as never,
          bytecode: intent.bytecode,
          args: (intent.constructorArgs || []) as never,
          chainId: intent.chainId,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      if (/user rejected|denied/i.test(msg)) {
        onResolved({ status: "rejected" });
      } else {
        onResolved({ status: "error", error: msg });
      }
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {intent && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="w-full rounded-2xl border border-white/10 bg-panel/90 p-5 text-left shadow-glow backdrop-blur-md"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-white">Confirm action</h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-signal">
              {intent.kind}
            </span>
          </div>
          <p className="text-sm text-mist">{intent.summary}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-xs text-mist/90">
            <div>
              <dt className="text-mist/50">chain</dt>
              <dd className="text-white">{chainByKey[intent.chainKey].name}</dd>
            </div>
            <div>
              <dt className="text-mist/50">chain id</dt>
              <dd className="text-white">{intent.chainId}</dd>
            </div>
            {intent.to && (
              <div className="col-span-2">
                <dt className="text-mist/50">to</dt>
                <dd className="break-all text-white">{intent.to}</dd>
              </div>
            )}
            {intent.nativeAmount && (
              <div>
                <dt className="text-mist/50">native amount</dt>
                <dd className="text-white">{intent.nativeAmount}</dd>
              </div>
            )}
            <div>
              <dt className="text-mist/50">est. gas</dt>
              <dd className="text-white">
                {gasEstimate
                  ? gasEstimate.toString()
                  : gasError
                    ? "unavailable"
                    : intent.kind === "deploy"
                      ? "on confirm"
                      : "estimating…"}
              </dd>
            </div>
          </dl>
          {overCap && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
              Amount exceeds session soft cap ({spendCap}). You can still confirm — double-check the
              figure.
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void confirm()}
              className="flex-1 rounded-xl bg-signal px-4 py-3 text-sm font-semibold text-ink disabled:opacity-60"
            >
              {submitting ? "Awaiting wallet…" : "Confirm in wallet"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={onClear}
              className="rounded-xl border border-white/15 px-4 py-3 text-sm text-mist"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
