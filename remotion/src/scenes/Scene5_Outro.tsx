import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from "remotion";
import { loadFont } from "@remotion/google-fonts/Poppins";

const { fontFamily: poppins } = loadFont("normal", { weights: ["900", "600"], subsets: ["latin"] });

export const Scene5_Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Everything fades/scales in
  const mainS = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Fox with rotating border
  const foxS = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 100 } });
  const borderRotate = frame * 2;

  // Text
  const textS = spring({ frame: frame - 25, fps, config: { damping: 15, stiffness: 100 } });

  // Tagline
  const tagS = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 100 } });

  // Breathing glow
  const breathe = interpolate(frame, [0, 45, 90], [0.1, 0.2, 0.1], { extrapolateRight: "clamp" });

  // Fade out at end
  const fadeOut = interpolate(frame, [75, 90], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f", justifyContent: "center", alignItems: "center", opacity: fadeOut }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", width: 800, height: 800, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(245,158,11,${breathe}) 0%, transparent 50%)`,
      }} />

      {/* Rotating border ring */}
      <div style={{
        position: "absolute", width: 220, height: 220, borderRadius: "50%",
        border: "2px solid transparent",
        borderTopColor: "#f59e0b",
        borderRightColor: "rgba(245,158,11,0.3)",
        transform: `rotate(${borderRotate}deg) scale(${foxS})`,
        top: "28%",
      }} />

      {/* Fox */}
      <div style={{
        position: "absolute", top: "28%",
        width: 200, height: 200, borderRadius: "50%", overflow: "hidden",
        transform: `scale(${foxS})`,
        boxShadow: "0 0 60px rgba(245,158,11,0.3)",
      }}>
        <Img src={staticFile("images/fox.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {/* FOX DEV */}
      <div style={{
        position: "absolute", top: "48%",
        fontFamily: poppins, fontSize: 90, fontWeight: 900,
        color: "#f59e0b",
        transform: `scale(${textS})`, opacity: textS,
        textShadow: "0 0 40px rgba(245,158,11,0.4)",
      }}>
        FOX DEV
      </div>

      {/* Tagline */}
      <div style={{
        position: "absolute", top: "58%",
        fontFamily: poppins, fontSize: 28, fontWeight: 600,
        color: "rgba(255,255,255,0.5)",
        letterSpacing: 12,
        transform: `scale(${tagS})`, opacity: tagS,
      }}>
        NON ENDING LEGACY
      </div>

      {/* Separator line */}
      <div style={{
        position: "absolute", top: "64%",
        width: interpolate(tagS, [0, 1], [0, 300]),
        height: 2, backgroundColor: "rgba(245,158,11,0.3)",
        borderRadius: 1,
      }} />

      {/* Year */}
      <div style={{
        position: "absolute", top: "68%",
        fontFamily: poppins, fontSize: 20, fontWeight: 600,
        color: "rgba(255,255,255,0.25)",
        letterSpacing: 8,
        transform: `scale(${tagS})`, opacity: tagS,
      }}>
        2 0 2 5
      </div>
    </AbsoluteFill>
  );
};
