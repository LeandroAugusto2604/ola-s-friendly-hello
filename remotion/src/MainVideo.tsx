import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Problem } from "./scenes/Scene2Problem";
import { Scene3Features } from "./scenes/Scene3Features";
import { Scene4Dashboard } from "./scenes/Scene4Dashboard";
import { Scene5CTA } from "./scenes/Scene5CTA";

const TRANSITION = 20;
const timing = springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION });

export const MainVideo = () => {
  const frame = useCurrentFrame();

  // Persistent animated background
  const gradAngle = interpolate(frame, [0, 600], [135, 180]);
  const bg1 = `hsl(220, 30%, ${interpolate(frame, [0, 600], [6, 10])}%)`;
  const bg2 = `hsl(225, 35%, ${interpolate(frame, [0, 600], [12, 16])}%)`;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(${gradAngle}deg, ${bg1}, ${bg2})` }}>
      {/* Floating accent circles */}
      <FloatingAccents frame={frame} />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={110}>
          <Scene1Hook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={100}>
          <Scene2Problem />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={160}>
          <Scene3Features />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={150}>
          <Scene4Dashboard />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={140}>
          <Scene5CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

const FloatingAccents = ({ frame }: { frame: number }) => {
  const circles = [
    { x: 150, y: 200, size: 300, speed: 0.8, opacity: 0.04 },
    { x: 1600, y: 700, size: 400, speed: 0.5, opacity: 0.03 },
    { x: 900, y: 100, size: 200, speed: 1.2, opacity: 0.05 },
  ];

  return (
    <>
      {circles.map((c, i) => {
        const dx = Math.sin(frame * 0.01 * c.speed) * 30;
        const dy = Math.cos(frame * 0.012 * c.speed) * 20;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.x + dx,
              top: c.y + dy,
              width: c.size,
              height: c.size,
              borderRadius: "50%",
              background: "radial-gradient(circle, hsl(220, 70%, 50%) 0%, transparent 70%)",
              opacity: c.opacity,
            }}
          />
        );
      })}
    </>
  );
};
