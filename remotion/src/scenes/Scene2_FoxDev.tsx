import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from "remotion";
import { loadFont } from "@remotion/google-fonts/Poppins";

const { fontFamily: poppins } = loadFont("normal", { weights: ["900"], subsets: ["latin"] });

export const Scene2_FoxDev: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fox stays but smaller, moves up
  const foxY = interpolate(spring({ frame, fps, config: { damping: 20, stiffness: 100 } }), [0, 1], [0, -280]);
  const foxScale = interpolate(spring({ frame, fps, config: { damping: 20, stiffness: 100 } }), [0, 1], [1, 0.6]);

  // "FOX" text - each letter springs in
  const foxLetters = "FOX".split("");
  const devLetters = "DEV".split("");

  // Underline
  const lineWidth = interpolate(spring({ frame: frame - 35, fps, config: { damping: 20, stiffness: 120 } }), [0, 1], [0, 500]);

  // Subtle bg glow
  const bgGlow = interpolate(frame, [0, 60, 120], [0.05, 0.1, 0.05], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f", justifyContent: "center", alignItems: "center" }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", width: 600, height: 600, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(245,158,11,${bgGlow}) 0%, transparent 60%)`,
        top: "20%",
      }} />

      {/* Fox image - moves up */}
      <div style={{
        position: "absolute",
        transform: `translateY(${foxY}px) scale(${foxScale})`,
        width: 200, height: 200, borderRadius: "50%", overflow: "hidden",
        border: "4px solid rgba(245,158,11,0.5)",
        boxShadow: "0 0 40px rgba(245,158,11,0.2)",
      }}>
        <Img src={staticFile("images/fox.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {/* FOX text */}
      <div style={{ display: "flex", gap: 8, position: "absolute", top: "48%" }}>
        {foxLetters.map((letter, i) => {
          const s = spring({ frame: frame - 15 - i * 5, fps, config: { damping: 10, stiffness: 150 } });
          const y = interpolate(s, [0, 1], [80, 0]);
          const rotate = interpolate(s, [0, 1], [20, 0]);
          return (
            <div key={i} style={{
              fontFamily: poppins, fontSize: 140, fontWeight: 900, color: "#f59e0b",
              transform: `translateY(${y}px) rotate(${rotate}deg)`,
              opacity: s,
              textShadow: "0 0 40px rgba(245,158,11,0.4), 0 4px 20px rgba(0,0,0,0.5)",
            }}>
              {letter}
            </div>
          );
        })}
      </div>

      {/* DEV text */}
      <div style={{ display: "flex", gap: 8, position: "absolute", top: "62%" }}>
        {devLetters.map((letter, i) => {
          const s = spring({ frame: frame - 25 - i * 5, fps, config: { damping: 10, stiffness: 150 } });
          const y = interpolate(s, [0, 1], [80, 0]);
          const rotate = interpolate(s, [0, 1], [-15, 0]);
          return (
            <div key={i} style={{
              fontFamily: poppins, fontSize: 140, fontWeight: 900, color: "#ffffff",
              transform: `translateY(${y}px) rotate(${rotate}deg)`,
              opacity: s,
              textShadow: "0 0 30px rgba(255,255,255,0.15), 0 4px 20px rgba(0,0,0,0.5)",
            }}>
              {letter}
            </div>
          );
        })}
      </div>

      {/* Underline */}
      <div style={{
        position: "absolute", top: "78%", height: 4, borderRadius: 2,
        width: lineWidth, backgroundColor: "#f59e0b",
        boxShadow: "0 0 20px rgba(245,158,11,0.5)",
      }} />
    </AbsoluteFill>
  );
};
