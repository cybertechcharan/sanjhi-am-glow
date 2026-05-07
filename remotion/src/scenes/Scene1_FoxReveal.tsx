import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from "remotion";

export const Scene1_FoxReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background pulse
  const bgPulse = interpolate(frame, [0, 60, 120], [0.03, 0.08, 0.03], { extrapolateRight: "clamp" });

  // Fox image entrance - scale from 0 with spring
  const foxScale = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 80 } });
  const foxRotate = interpolate(spring({ frame: frame - 10, fps, config: { damping: 15, stiffness: 60 } }), [0, 1], [-180, 0]);

  // Ring animations
  const ring1 = spring({ frame: frame - 20, fps, config: { damping: 20, stiffness: 100 } });
  const ring2 = spring({ frame: frame - 30, fps, config: { damping: 20, stiffness: 100 } });
  const ring3 = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 100 } });

  // Glow pulse
  const glowScale = interpolate(frame, [30, 60, 90, 120], [1, 1.3, 1, 1.3], { extrapolateRight: "clamp" });
  const glowOpacity = interpolate(frame, [30, 60, 90, 120], [0.3, 0.6, 0.3, 0.6], { extrapolateRight: "clamp" });

  // Particles
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const delay = 40 + i * 3;
    const prog = spring({ frame: frame - delay, fps, config: { damping: 30, stiffness: 60 } });
    const radius = interpolate(prog, [0, 1], [0, 300 + (i % 3) * 80]);
    const x = Math.cos(angle + frame * 0.02) * radius;
    const y = Math.sin(angle + frame * 0.02) * radius;
    const size = 4 + (i % 4) * 3;
    const opacity = interpolate(prog, [0, 0.3, 1], [0, 1, 0.4]);
    return { x, y, size, opacity };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f", justifyContent: "center", alignItems: "center" }}>
      {/* Subtle radial bg */}
      <div style={{
        position: "absolute", width: 800, height: 800, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(200,120,50,${bgPulse}) 0%, transparent 70%)`,
      }} />

      {/* Particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute",
          width: p.size, height: p.size, borderRadius: "50%",
          backgroundColor: i % 2 === 0 ? "#f59e0b" : "#ea580c",
          opacity: p.opacity,
          transform: `translate(${p.x}px, ${p.y}px)`,
        }} />
      ))}

      {/* Glow behind fox */}
      <div style={{
        position: "absolute", width: 350, height: 350, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%)",
        transform: `scale(${glowScale})`,
        opacity: glowOpacity,
      }} />

      {/* Rings */}
      {[
        { s: ring1, size: 400, color: "rgba(245,158,11,0.15)" },
        { s: ring2, size: 550, color: "rgba(234,88,12,0.1)" },
        { s: ring3, size: 700, color: "rgba(245,158,11,0.06)" },
      ].map((r, i) => (
        <div key={i} style={{
          position: "absolute",
          width: r.size, height: r.size, borderRadius: "50%",
          border: `2px solid ${r.color}`,
          transform: `scale(${r.s}) rotate(${frame * (i % 2 === 0 ? 1 : -1)}deg)`,
          opacity: r.s,
        }} />
      ))}

      {/* Fox image */}
      <div style={{
        width: 260, height: 260, borderRadius: "50%", overflow: "hidden",
        transform: `scale(${foxScale}) rotate(${foxRotate}deg)`,
        border: "5px solid rgba(245,158,11,0.6)",
        boxShadow: "0 0 60px rgba(245,158,11,0.3), 0 0 120px rgba(234,88,12,0.15)",
      }}>
        <Img src={staticFile("images/fox.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    </AbsoluteFill>
  );
};
