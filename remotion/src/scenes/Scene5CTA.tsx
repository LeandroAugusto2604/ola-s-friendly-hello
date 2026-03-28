import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
const { fontFamily } = loadFont("normal", { weights: ["700", "400"], subsets: ["latin"] });

export const Scene5CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Main text
  const mainSpring = spring({ frame, fps, config: { damping: 15, stiffness: 100 } });
  const mainScale = interpolate(mainSpring, [0, 1], [0.8, 1]);
  const mainOp = interpolate(mainSpring, [0, 1], [0, 1]);

  // Brand
  const brandSpring = spring({ frame: frame - 25, fps, config: { damping: 20 } });
  const brandOp = interpolate(brandSpring, [0, 1], [0, 1]);
  const brandY = interpolate(brandSpring, [0, 1], [40, 0]);

  // URL
  const urlSpring = spring({ frame: frame - 45, fps, config: { damping: 20 } });
  const urlOp = interpolate(urlSpring, [0, 1], [0, 1]);

  // Glow
  const glowOp = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.1, 0.3]);

  // Final fade out
  const fadeOut = interpolate(frame, [110, 140], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, justifyContent: "center", alignItems: "center", opacity: fadeOut }}>
      {/* Glow */}
      <div style={{
        position: "absolute",
        width: 800,
        height: 800,
        borderRadius: "50%",
        background: "radial-gradient(circle, hsl(220, 70%, 50%) 0%, transparent 70%)",
        opacity: glowOp,
      }} />

      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
      }}>
        {/* Main text */}
        <div style={{
          opacity: mainOp,
          transform: `scale(${mainScale})`,
          fontSize: 64,
          fontWeight: 700,
          color: "white",
          textAlign: "center",
          lineHeight: 1.2,
          letterSpacing: -2,
        }}>
          Simplifique sua<br />gestão de empréstimos
        </div>

        {/* Brand */}
        <div style={{
          opacity: brandOp,
          transform: `translateY(${brandY}px)`,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(135deg, hsl(220, 70%, 50%), hsl(200, 80%, 45%))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 40px hsl(220, 70%, 50%, 0.4)",
          }}>
            <span style={{ fontSize: 28, color: "white", fontWeight: 700 }}>$</span>
          </div>
          <span style={{ fontSize: 42, fontWeight: 700, color: "white" }}>LoanManager</span>
        </div>

        {/* URL */}
        <div style={{
          opacity: urlOp,
          fontSize: 22,
          color: "hsl(220, 70%, 60%)",
          fontWeight: 400,
        }}>
          emprestimo-zl.lovable.app
        </div>
      </div>
    </AbsoluteFill>
  );
};
