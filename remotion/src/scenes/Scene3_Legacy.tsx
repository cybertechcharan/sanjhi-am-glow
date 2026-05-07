import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Poppins";
import { loadFont as loadOrbitron } from "@remotion/google-fonts/Orbitron";

const { fontFamily: poppins } = loadFont("normal", { weights: ["900", "700"], subsets: ["latin"] });
const { fontFamily: orbitron } = loadOrbitron("normal", { weights: ["900"], subsets: ["latin"] });

export const Scene3_Legacy: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "NON ENDING" reveal
  const nonEndingLetters = "NON ENDING".split("");
  // "LEGACY" reveal
  const legacyLetters = "LEGACY".split("");

  // Horizontal lines sweep
  const lineLeft = interpolate(spring({ frame: frame - 5, fps, config: { damping: 25, stiffness: 100 } }), [0, 1], [-600, 0]);
  const lineRight = interpolate(spring({ frame: frame - 5, fps, config: { damping: 25, stiffness: 100 } }), [0, 1], [600, 0]);

  // Pulsing diamond accent
  const diamondScale = interpolate(frame, [60, 90, 120, 150], [1, 1.3, 1, 1.3], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const diamondOpacity = spring({ frame: frame - 50, fps, config: { damping: 20 } });

  // Background particles moving upward
  const bgParticles = Array.from({ length: 8 }, (_, i) => {
    const x = (i / 8) * 1080;
    const speed = 1.5 + (i % 3) * 0.8;
    const y = 1920 - ((frame * speed + i * 200) % 2200);
    const opacity = interpolate(y, [0, 400, 1600, 1920], [0, 0.3, 0.3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return { x, y, opacity, size: 3 + (i % 3) * 2 };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f", justifyContent: "center", alignItems: "center" }}>
      {/* Rising particles */}
      {bgParticles.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: p.x, top: p.y,
          width: p.size, height: p.size, borderRadius: "50%",
          backgroundColor: "#f59e0b", opacity: p.opacity,
        }} />
      ))}

      {/* Horizontal accent lines */}
      <div style={{
        position: "absolute", top: "38%", left: "50%", width: 400, height: 1,
        backgroundColor: "rgba(245,158,11,0.3)",
        transform: `translateX(${lineLeft}px)`,
      }} />
      <div style={{
        position: "absolute", top: "38%", right: "50%", width: 400, height: 1,
        backgroundColor: "rgba(245,158,11,0.3)",
        transform: `translateX(${lineRight}px)`,
      }} />

      {/* "NON ENDING" */}
      <div style={{ display: "flex", gap: 4, position: "absolute", top: "40%", flexWrap: "wrap", justifyContent: "center", width: 900 }}>
        {nonEndingLetters.map((letter, i) => {
          const s = spring({ frame: frame - 8 - i * 3, fps, config: { damping: 12, stiffness: 180 } });
          const scale = interpolate(s, [0, 1], [2.5, 1]);
          const waveY = Math.sin((frame - i * 4) * 0.08) * 6;
          return (
            <div key={i} style={{
              fontFamily: orbitron, fontSize: 72, fontWeight: 900,
              color: "#f59e0b",
              transform: `scale(${scale}) translateY(${waveY}px)`,
              opacity: s,
              textShadow: "0 0 30px rgba(245,158,11,0.5)",
            }}>
              {letter === " " ? "\u00A0" : letter}
            </div>
          );
        })}
      </div>

      {/* Diamond separator */}
      <div style={{
        position: "absolute", top: "52%",
        width: 16, height: 16, backgroundColor: "#f59e0b",
        transform: `rotate(45deg) scale(${diamondScale})`,
        opacity: diamondOpacity,
        boxShadow: "0 0 20px rgba(245,158,11,0.6)",
      }} />

      {/* "LEGACY" */}
      <div style={{ display: "flex", gap: 12, position: "absolute", top: "56%" }}>
        {legacyLetters.map((letter, i) => {
          const s = spring({ frame: frame - 30 - i * 4, fps, config: { damping: 8, stiffness: 120 } });
          const y = interpolate(s, [0, 1], [120, 0]);
          const waveY = Math.sin((frame - i * 5) * 0.06) * 8;
          return (
            <div key={i} style={{
              fontFamily: poppins, fontSize: 120, fontWeight: 900,
              color: "#ffffff",
              transform: `translateY(${y + waveY}px)`,
              opacity: s,
              textShadow: "0 0 20px rgba(255,255,255,0.2), 0 4px 30px rgba(0,0,0,0.6)",
            }}>
              {letter}
            </div>
          );
        })}
      </div>

      {/* Bottom accent lines */}
      <div style={{
        position: "absolute", top: "72%", left: "50%", width: 400, height: 1,
        backgroundColor: "rgba(245,158,11,0.3)",
        transform: `translateX(${lineLeft}px)`,
      }} />
      <div style={{
        position: "absolute", top: "72%", right: "50%", width: 400, height: 1,
        backgroundColor: "rgba(245,158,11,0.3)",
        transform: `translateX(${lineRight}px)`,
      }} />
    </AbsoluteFill>
  );
};
