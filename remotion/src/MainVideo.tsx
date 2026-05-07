import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1_FoxReveal } from "./scenes/Scene1_FoxReveal";
import { Scene2_FoxDev } from "./scenes/Scene2_FoxDev";
import { Scene3_Legacy } from "./scenes/Scene3_Legacy";
import { Scene4_NotReady } from "./scenes/Scene4_NotReady";
import { Scene5_Outro } from "./scenes/Scene5_Outro";

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={120}>
          <Scene1_FoxReveal />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={120}>
          <Scene2_FoxDev />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-bottom-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />

        <TransitionSeries.Sequence durationInFrames={150}>
          <Scene3_Legacy />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
        />

        <TransitionSeries.Sequence durationInFrames={130}>
          <Scene4_NotReady />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 15 })}
        />

        <TransitionSeries.Sequence durationInFrames={90}>
          <Scene5_Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
