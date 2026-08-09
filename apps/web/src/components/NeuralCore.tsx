"use client";

import { motion } from "framer-motion";

/* ─── Neural network node definitions ─── */
const NODES = [
  { id: "input",  cx: 74,  cy: 22,  r: 4   },
  { id: "voice",  cx: 28,  cy: 74,  r: 3.5 },
  { id: "text",   cx: 120, cy: 74,  r: 3.5 },
  { id: "parse",  cx: 44,  cy: 132, r: 3.5 },
  { id: "chain",  cx: 104, cy: 132, r: 3.5 },
  { id: "core",   cx: 74,  cy: 188, r: 7   },
  { id: "sign",   cx: 34,  cy: 244, r: 3.5 },
  { id: "read",   cx: 114, cy: 244, r: 3.5 },
  { id: "output", cx: 74,  cy: 296, r: 4   },
] as const;

const EDGES: [string, string][] = [
  ["input", "voice"],
  ["input", "text"],
  ["voice", "parse"],
  ["text",  "chain"],
  ["parse", "core"],
  ["chain", "core"],
  ["core",  "sign"],
  ["core",  "read"],
  ["sign",  "output"],
  ["read",  "output"],
];

function nodeById(id: string) {
  return NODES.find((n) => n.id === id)!;
}

/* Animated dashed signal travelling along an edge */
function SignalEdge({
  x1, y1, x2, y2, delay,
}: {
  x1: number; y1: number; x2: number; y2: number; delay: number;
}) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return (
    <motion.line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="rgba(61,214,198,0.55)"
      strokeWidth={0.9}
      strokeDasharray={`${len * 0.18} ${len * 0.82}`}
      strokeDashoffset={len}
      animate={{ strokeDashoffset: [len, -len] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "linear", delay }}
    />
  );
}

export function NeuralCore() {
  return (
    <div className="flex flex-col items-end gap-1">
      {/* panel label */}
      <p className="pr-1 font-mono text-[9px] tracking-[0.32em] text-signal/70">
        NEURAL.CORE
      </p>

      <svg
        width={100}
        height={215}
        viewBox="0 0 148 320"
        className="overflow-visible"
      >
        {/* ── defs: blur glow filter ── */}
        <defs>
          <filter id="nc-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="nc-glow-lg" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── static dim edges (base layer) ── */}
        {EDGES.map(([a, b]) => {
          const na = nodeById(a);
          const nb = nodeById(b);
          return (
            <line
              key={`base-${a}-${b}`}
              x1={na.cx} y1={na.cy}
              x2={nb.cx} y2={nb.cy}
              stroke="rgba(61,214,198,0.12)"
              strokeWidth={0.7}
            />
          );
        })}

        {/* ── animated signal pulses along edges ── */}
        {EDGES.map(([a, b], i) => {
          const na = nodeById(a);
          const nb = nodeById(b);
          return (
            <SignalEdge
              key={`sig-${a}-${b}`}
              x1={na.cx} y1={na.cy}
              x2={nb.cx} y2={nb.cy}
              delay={i * 0.26}
            />
          );
        })}

        {/* ── nodes ── */}
        {NODES.map((node, i) => {
          const isCore = node.id === "core";
          return (
            <g key={node.id} filter={isCore ? "url(#nc-glow-lg)" : "url(#nc-glow)"}>
              {/* outer pulse ring */}
              <motion.circle
                cx={node.cx} cy={node.cy} r={node.r + 4}
                fill="none"
                stroke="rgba(61,214,198,0.18)"
                strokeWidth={isCore ? 1.5 : 1}
                animate={{ r: [node.r + 4, node.r + 8, node.r + 4], opacity: [0.18, 0.5, 0.18] }}
                transition={{ duration: isCore ? 1.6 : 2.4, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
              />
              {/* inner filled dot */}
              <motion.circle
                cx={node.cx} cy={node.cy} r={node.r}
                fill={isCore ? "rgba(61,214,198,0.95)" : "rgba(61,214,198,0.7)"}
                animate={{ opacity: isCore ? [0.85, 1, 0.85] : [0.55, 0.9, 0.55] }}
                transition={{ duration: isCore ? 1.2 : 2, repeat: Infinity, delay: i * 0.2 }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
