import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

export const Scene2Problem = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "Problema" text
  const prob = spring({ frame, fps, config: { damping: 20 } });
  const probOp = interpolate(prob, [0, 1], [0, 1]);
  const probX = interpolate(prob, [0, 1], [-80, 0]);

  // X mark
  const xScale = spring({ frame: frame - 20, fps, config: { damping: 10, stiffness: 200 } });

  // Solution text
  const solSpring = spring({ frame: frame - 45, fps, config: { damping: 18 } });
  const solOp = interpolate(solSpring, [0, 1], [0, 1]);
  const solX = interpolate(solSpring, [0, 1], [80, 0]);

  // Check mark
  const checkScale = spring({ frame: frame - 55, fps, config: { damping: 10 } });

  return (
    <AbsoluteFill style={{ fontFamily, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 60, alignItems: "center" }}>
        {/* Problem */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          opacity: probOp,
          transform: `translateX(${probX}px)`,
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "hsl(0, 72%, 51%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${xScale})`,
            boxShadow: "0 8px 30px hsl(0, 72%, 51%, 0.3)",
          }}>
            <span style={{ fontSize: 36, color: "white", fontWeight: 700 }}>✕</span>
          </div>
          <span style={{ fontSize: 36, color: "hsl(0, 20%, 70%)", fontWeight: 500 }}>
            Controle no papel e planilhas
          </span>
        </div>

        {/* Divider line */}
        <div style={{
          width: interpolate(spring({ frame: frame - 35, fps, config: { damping: 200 } }), [0, 1], [0, 500]),
          height: 2,
          background: "linear-gradient(90deg, transparent, hsl(220, 30%, 30%), transparent)",
        }} />

        {/* Solution */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          opacity: solOp,
          transform: `translateX(${solX}px)`,
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "linear-gradient(135deg, hsl(142, 76%, 36%), hsl(160, 70%, 40%))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${checkScale})`,
            boxShadow: "0 8px 30px hsl(142, 76%, 36%, 0.3)",
          }}>
            <span style={{ fontSize: 36, color: "white", fontWeight: 700 }}>✓</span>
          </div>
          <span style={{ fontSize: 36, color: "white", fontWeight: 500 }}>
            Gestão digital completa
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
