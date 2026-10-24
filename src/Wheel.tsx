import { useId } from "react";
import { models, finishes, calipers, rimRatio } from "./catalog";
export default function Wheel({
  model = 0,
  finish = 0,
  caliper = 4,
  angle = 20,
  size = 18,
}: {
  model?: number;
  finish?: number;
  caliper?: number;
  angle?: number;
  size?: number;
}) {
  const id = useId().replace(/:/g, "");
  const m = models[model] || models[0],
    color = finishes[finish][1],
    r = 100 * rimRatio(size);
  return (
    <svg
      viewBox="-110 -110 220 220"
      role="img"
      aria-label={`${m.name}, aro ${size}, ${finishes[finish][0]}`}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <radialGradient id={id + "t"}>
          <stop offset="68%" stopColor="#070a0b" />
          <stop offset="82%" stopColor="#292c2d" />
          <stop offset="91%" stopColor="#111415" />
          <stop offset="96%" stopColor="#34393a" />
          <stop offset="100%" stopColor="#080a0a" />
        </radialGradient>
        <linearGradient id={id + "m"} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f5fafb" />
          <stop offset=".2" stopColor={color} />
          <stop offset=".5" stopColor={color} />
          <stop offset=".7" stopColor={finish === 6 ? "#404449" : "#899296"} />
          <stop offset="1" stopColor="#13191e" />
        </linearGradient>
        <radialGradient id={id + "d"}>
          <stop stopColor="#46505a" />
          <stop offset=".5" stopColor="#c1c8cc" />
          <stop offset=".9" stopColor="#77838a" />
          <stop offset="1" stopColor="#cbd1d2" />
        </radialGradient>
        <linearGradient id={id + "c"}>
          <stop stopColor="#fff" stopOpacity=".7" />
          <stop offset=".3" stopColor={calipers[caliper][1]} />
          <stop offset=".8" stopColor={calipers[caliper][1]} />
          <stop offset="1" stopColor="#171c20" />
        </linearGradient>
      </defs>
      <circle r="105" fill={`url(#${id}t)`} />
      <circle
        r="99"
        fill="none"
        stroke="#4b5153"
        strokeWidth=".6"
        strokeDasharray="2 3"
      />
      <circle r={r} fill="#141b20" stroke={`url(#${id}m)`} strokeWidth="5" />
      <g transform={`scale(${r / 90})`}>
        <circle r="67" fill={`url(#${id}d)`} />
        {[25, 32, 39, 46, 53, 60, 64].map((v) => (
          <circle
            key={v}
            r={v}
            fill="none"
            stroke="#e0e4e6"
            strokeWidth=".5"
            opacity=".5"
          />
        ))}
        {Array.from({ length: 24 }, (_, i) => (
          <g key={i} transform={`rotate(${i * 15})`}>
            <circle cx="52" cy="0" r="1.5" fill="#303d45" />
            <circle cx="60" cy="6" r="1.2" fill="#303d45" />
            <path
              d="M 33 7 L 60 15"
              stroke="#4c5c65"
              strokeWidth=".6"
              opacity=".5"
            />
          </g>
        ))}
        <g transform={`rotate(${angle}) translate(53 0)`}>
          <rect
            x="-10"
            y="-28"
            width="23"
            height="56"
            rx="8"
            fill={`url(#${id}c)`}
            stroke="#0008"
            strokeWidth="1"
          />
          <circle cx="1" cy="-19" r="3" fill="#fff6" />
          <circle cx="1" cy="19" r="3" fill="#0005" />
          <text
            transform="rotate(90)"
            x="0"
            y="2"
            textAnchor="middle"
            fill="white"
            fontSize="6"
            fontWeight="bold"
          >
            BREMBO
          </text>
        </g>
        {Array.from({ length: m.spokes }, (_, i) => (
          <g key={i} transform={`rotate(${(i * 360) / m.spokes})`}>
            {m.design === "mesh" ? (
              <>
                <path
                  d="M-4 19 L-24 70 L-3 86 L4 81 L-13 68 L4 25 Z"
                  fill={`url(#${id}m)`}
                />
                <path
                  d="M4 19 L24 70 L3 86 L-4 81 L13 68 L-4 25 Z"
                  fill={`url(#${id}m)`}
                />
              </>
            ) : m.design === "split" ? (
              <path
                d="M-6 18 L-18 80 L-12 87 L-3 39 L5 39 L13 87 L19 80 L6 18 Z"
                fill={`url(#${id}m)`}
              />
            ) : m.design === "turbine" || m.design === "blade" ? (
              <path
                d="M-7 15 Q-5 50 -32 79 L-17 87 Q17 55 8 18 Z"
                fill={`url(#${id}m)`}
                stroke="#d2d6d733"
              />
            ) : (
              <path
                d={
                  m.design === "solid"
                    ? "M-9 16 L-13 82 L12 82 L9 16 Z"
                    : "M-8 16 L-14 73 L-7 87 L8 87 L15 73 L8 16 Z"
                }
                fill={`url(#${id}m)`}
                stroke="#b9c5ce55"
                strokeWidth=".7"
              />
            )}
          </g>
        ))}
        <circle
          r="87"
          fill="none"
          stroke={`url(#${id}m)`}
          strokeWidth={model === 7 ? 8 : 4}
        />
        {[0, 1, 5, 7, 10, 13].includes(model) &&
          Array.from({ length: 16 }, (_, i) => (
            <circle
              key={i}
              cx={82 * Math.cos((i * Math.PI) / 8)}
              cy={82 * Math.sin((i * Math.PI) / 8)}
              r="1.8"
              fill={model === 7 ? "#171c21" : "#e0e6e7"}
            />
          ))}
        <circle r="19" fill={`url(#${id}m)`} />
        {Array.from({ length: m.lugs }, (_, i) => (
          <circle
            key={i}
            cx={13 * Math.cos((i * 2 * Math.PI) / m.lugs)}
            cy={13 * Math.sin((i * 2 * Math.PI) / m.lugs)}
            r="2.4"
            fill="#12181c"
            stroke="#909da5"
          />
        ))}
        <circle r="8" fill="#252f35" stroke="#a0aeb8" strokeWidth="1" />
        {model === 10 && (
          <text
            y="-72"
            textAnchor="middle"
            fill="white"
            fontSize="7"
            letterSpacing="2"
          >
            O F F R O A D
          </text>
        )}
      </g>
    </svg>
  );
}
