import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
const { fontFamily } = loadFont("normal", { weights: ["700", "600", "400"], subsets: ["latin"] });

const stats = [
  { label: "Clientes", value: 48, color: "hsl(220, 70%, 50%)", prefix: "" },
  { label: "Emprestado", value: 125000, color: "hsl(142, 76%, 40%)", prefix: "R$ ", format: true },
  { label: "Recebido", value: 87500, color: "hsl(270, 60%, 55%)", prefix: "R$ ", format: true },
  { label: "Parcelas Vencidas", value: 3, color: "hsl(0, 72%, 51%)", prefix: "" },
];

export const Scene4Dashboard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Dashboard card scale-in
  const dashSpring = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const dashScale = interpolate(dashSpring, [0, 1], [0.9, 1]);
  const dashOp = interpolate(dashSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ fontFamily, justifyContent: "center", alignItems: "center" }}>
      <div style={{
        opacity: dashOp,
        transform: `scale(${dashScale})`,
        width: 1500,
        borderRadius: 32,
        background: "linear-gradient(165deg, hsl(220, 25%, 13%), hsl(220, 25%, 9%))",
        border: "1px solid hsl(220, 20%, 18%)",
        padding: 56,
        boxShadow: "0 40px 80px hsl(220, 30%, 3%, 0.6)",
      }}>
        {/* Header bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 48,
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "linear-gradient(135deg, hsl(220, 70%, 50%), hsl(200, 80%, 45%))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span style={{ fontSize: 24, color: "white", fontWeight: 700 }}>$</span>
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, color: "white" }}>LoanManager</span>
          <div style={{ flex: 1 }} />
          <div style={{
            padding: "8px 16px",
            borderRadius: 20,
            background: "hsl(142, 60%, 20%)",
            fontSize: 14,
            color: "hsl(142, 70%, 60%)",
            fontWeight: 600,
          }}>● Tempo real</div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "flex", gap: 24 }}>
          {stats.map((stat, i) => {
            const delay = 15 + i * 12;
            const s = spring({ frame: frame - delay, fps, config: { damping: 20 } });
            const cardOp = interpolate(s, [0, 1], [0, 1]);
            const cardY = interpolate(s, [0, 1], [30, 0]);

            // Counting animation
            const countProgress = interpolate(frame - delay, [0, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const currentVal = Math.round(stat.value * countProgress);
            const displayVal = stat.format
              ? stat.prefix + currentVal.toLocaleString("pt-BR")
              : stat.prefix + currentVal;

            return (
              <div key={i} style={{
                flex: 1,
                opacity: cardOp,
                transform: `translateY(${cardY}px)`,
                padding: "32px 28px",
                borderRadius: 20,
                background: "hsl(220, 25%, 10%)",
                border: "1px solid hsl(220, 20%, 16%)",
              }}>
                <div style={{ fontSize: 15, color: "hsl(220, 15%, 50%)", fontWeight: 600, marginBottom: 12 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, color: stat.color }}>
                  {displayVal}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fake table rows */}
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2].map((i) => {
            const rowDelay = 60 + i * 10;
            const rowOp = interpolate(frame - rowDelay, [0, 15], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{
                height: 48,
                borderRadius: 12,
                background: `hsl(220, 20%, ${12 + i}%)`,
                opacity: rowOp,
              }} />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
