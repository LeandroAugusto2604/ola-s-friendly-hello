import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
const { fontFamily } = loadFont("normal", { weights: ["700", "400"], subsets: ["latin"] });

export const Scene1Hook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Icon animation
  const iconScale = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const iconRotate = interpolate(spring({ frame, fps, config: { damping: 20 } }), [0, 1], [-90, 0]);

  // Title reveal
  const titleSpring = spring({ frame: frame - 15, fps, config: { damping: 18, stiffness: 180 } });
  const titleY = interpolate(titleSpring, [0, 1], [60, 0]);
  const titleOp = interpolate(titleSpring, [0, 1], [0, 1]);

  // Subtitle
  const subSpring = spring({ frame: frame - 30, fps, config: { damping: 20 } });
  const subOp = interpolate(subSpring, [0, 1], [0, 1]);
  const subY = interpolate(subSpring, [0, 1], [30, 0]);

  // Subtle glow pulse
  const glowOp = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.15, 0.35]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily }}>
      {/* Central glow */}
      <div style={{
        position: "absolute",
        width: 600,
        height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, hsl(220, 70%, 50%) 0%, transparent 70%)",
        opacity: glowOp,
      }} />

      {/* Dollar icon */}
      <div style={{
        transform: `scale(${iconScale}) rotate(${iconRotate}deg)`,
        width: 120,
        height: 120,
        borderRadius: 28,
        background: "linear-gradient(135deg, hsl(220, 70%, 50%), hsl(200, 80%, 45%))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 20px 60px hsl(220, 70%, 50%, 0.4)",
        marginBottom: 40,
      }}>
        <span style={{ fontSize: 60, color: "white", fontWeight: 700 }}>$</span>
      </div>

      {/* Title */}
      <div style={{
        transform: `translateY(${titleY}px)`,
        opacity: titleOp,
        fontSize: 82,
        fontWeight: 700,
        color: "white",
        letterSpacing: -2,
      }}>
        LoanManager
      </div>

      {/* Subtitle */}
      <div style={{
        transform: `translateY(${subY}px)`,
        opacity: subOp,
        fontSize: 28,
        color: "hsl(220, 20%, 65%)",
        marginTop: 16,
        fontWeight: 400,
      }}>
        Sistema de Gestão de Empréstimos
      </div>
    </AbsoluteFill>
  );
};
