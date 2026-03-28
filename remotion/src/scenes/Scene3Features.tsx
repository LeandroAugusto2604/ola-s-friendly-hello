import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
const { fontFamily } = loadFont("normal", { weights: ["700", "600", "400"], subsets: ["latin"] });

const features = [
  { icon: "👤", title: "Cadastro Rápido", desc: "Clientes com CPF, RG e endereço" },
  { icon: "📊", title: "Parcelas Automáticas", desc: "Simulação e cálculo de juros" },
  { icon: "💳", title: "Pagamentos Flexíveis", desc: "Parcial, antecipado e juros" },
  { icon: "📱", title: "App no Celular", desc: "PWA instalável no iPhone e Android" },
];

export const Scene3Features = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title
  const titleSpring = spring({ frame, fps, config: { damping: 20 } });
  const titleOp = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [40, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, justifyContent: "center", alignItems: "center" }}>
      {/* Title */}
      <div style={{
        position: "absolute",
        top: 120,
        opacity: titleOp,
        transform: `translateY(${titleY}px)`,
        fontSize: 48,
        fontWeight: 700,
        color: "white",
        letterSpacing: -1,
      }}>
        Tudo que você precisa
      </div>

      {/* Feature cards */}
      <div style={{
        display: "flex",
        gap: 32,
        marginTop: 60,
      }}>
        {features.map((f, i) => {
          const delay = 20 + i * 18;
          const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 160 } });
          const cardY = interpolate(s, [0, 1], [80, 0]);
          const cardOp = interpolate(s, [0, 1], [0, 1]);

          // Subtle hover-like float
          const floatY = Math.sin((frame - delay) * 0.05 + i) * 3;

          return (
            <div key={i} style={{
              opacity: cardOp,
              transform: `translateY(${cardY + floatY}px)`,
              width: 340,
              padding: "48px 32px",
              borderRadius: 24,
              background: "linear-gradient(160deg, hsl(220, 25%, 14%), hsl(220, 25%, 11%))",
              border: "1px solid hsl(220, 20%, 20%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              boxShadow: "0 20px 40px hsl(220, 30%, 5%, 0.5)",
            }}>
              <span style={{ fontSize: 52 }}>{f.icon}</span>
              <span style={{ fontSize: 24, fontWeight: 600, color: "white", textAlign: "center" }}>
                {f.title}
              </span>
              <span style={{ fontSize: 17, color: "hsl(220, 15%, 55%)", textAlign: "center" }}>
                {f.desc}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
