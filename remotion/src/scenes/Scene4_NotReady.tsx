import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from "remotion";
import { loadFont } from "@remotion/google-fonts/Poppins";
import { loadFont as loadOrbitron } from "@remotion/google-fonts/Orbitron";

const { fontFamily: poppins } = loadFont("normal", { weights: ["900", "600"], subsets: ["latin"] });
const { fontFamily: orbitron } = loadOrbitron("normal", { weights: ["700"], subsets: ["latin"] });

export const Scene4_NotReady: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Zoom in effect on whole scene
  const zoom = interpolate(frame, [0, 150], [1, 1.08], { extrapolateRight: "clamp" });

  // Fox image - small, centered top
  const foxS = spring({ frame: frame - 5, fps, config: { damping: 15, stiffness: 100 } });

  // "YOU ARE" text
  const youAreS = spring({ frame: frame - 20, fps, config: { damping: 12, stiffness: 150 } });

  // "NOT READY" text - dramatic
  const notReadyLetters = "NOT READY".split("");

  // "FOR THIS" 
  const forThisS = spring({ frame: frame - 55, fps, config: { damping: 18, stiffness: 100 } });

  // Fox emoji
  const emojiS = spring({ frame: frame - 70, fps, config: { damping: 8, stiffness: 120 } });
  const emojiRotate = interpolate(emojiS, [0, 1], [-30, 0]);

  // Shockwave on "NOT READY"
  const shockwave = spring({ frame: frame - 40, fps, config: { damping: 30, stiffness: 60 } });
  const shockwaveScale = interpolate(shockwave, [0, 1], [0.5, 3]);
  const shockwaveOpacity = interpolate(shockwave, [0, 0.3, 1], [0, 0.4, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f", justifyContent: "center", alignItems: "center", transform: `scale(${zoom})` }}>
      {/* Red-orange danger glow */}
      <div style={{
        position: "absolute", width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 60%)",
      }} />

      {/* Shockwave */}
      <div style={{
        position: "absolute", width: 300, height: 300, borderRadius: "50%",
        border: "3px solid rgba(245,158,11,0.3)",
        transform: `scale(${shockwaveScale})`,
        opacity: shockwaveOpacity,
      }} />

      {/* Fox avatar small */}
      <div style={{
        position: "absolute", top: "22%",
        width: 100, height: 100, borderRadius: "50%", overflow: "hidden",
        transform: `scale(${foxS})`,
        border: "3px solid rgba(245,158,11,0.4)",
        boxShadow: "0 0 30px rgba(245,158,11,0.2)",
      }}>
        <Img src={staticFile("images/fox.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {/* "YOU ARE" */}
      <div style={{
        position: "absolute", top: "35%",
        fontFamily: orbitron, fontSize: 48, fontWeight: 700,
        color: "rgba(255,255,255,0.5)", letterSpacing: 20,
        transform: `scale(${youAreS})`, opacity: youAreS,
      }}>
        YOU ARE
      </div>

      {/* "NOT READY" */}
      <div style={{ display: "flex", gap: 6, position: "absolute", top: "42%", flexWrap: "wrap", justifyContent: "center", width: 900 }}>
        {notReadyLetters.map((letter, i) => {
          const s = spring({ frame: frame - 30 - i * 3, fps, config: { damping: 8, stiffness: 200 } });
          const scale = interpolate(s, [0, 1], [3, 1]);
          const shake = i > 3 ? Math.sin(frame * 0.5 + i) * interpolate(frame, [30 + i * 3, 60 + i * 3], [4, 0], { extrapolateRight: "clamp" }) : 0;
          return (
            <div key={i} style={{
              fontFamily: poppins, fontSize: 110, fontWeight: 900,
              color: i < 3 ? "#dc2626" : "#ffffff",
              transform: `scale(${scale}) translateX(${shake}px)`,
              opacity: s,
              textShadow: i < 3
                ? "0 0 40px rgba(220,38,38,0.6), 0 0 80px rgba(220,38,38,0.3)"
                : "0 0 20px rgba(255,255,255,0.15)",
            }}>
              {letter === " " ? "\u00A0" : letter}
            </div>
          );
        })}
      </div>

      {/* "FOR THIS" */}
      <div style={{
        position: "absolute", top: "58%",
        fontFamily: orbitron, fontSize: 56, fontWeight: 700,
        color: "rgba(245,158,11,0.9)", letterSpacing: 16,
        transform: `scale(${forThisS})`, opacity: forThisS,
        textShadow: "0 0 30px rgba(245,158,11,0.4)",
      }}>
        FOR THIS
      </div>

      {/* 🦊 emoji */}
      <div style={{
        position: "absolute", top: "68%",
        fontSize: 80,
        transform: `scale(${emojiS}) rotate(${emojiRotate}deg)`,
        opacity: emojiS,
      }}>
        🦊
      </div>
    </AbsoluteFill>
  );
};
