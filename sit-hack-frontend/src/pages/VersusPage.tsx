import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalibratingOverlay, CountdownOverlay } from "../components/Overlays";
import { ObstaclePrompt } from "../components/ObstaclePrompt";
import {
  VersusHud,
  VersusLobby,
  VersusResult,
  VersusWaiting,
} from "../components/Versus";
import { useVersusGame } from "../game/useVersusGame";

const CALIBRATION_CONFIDENCE_GATE = 0.8;

export function VersusPage() {
  const game = useVersusGame();
  const {
    videoRef,
    canvasRef,
    confidence,
    cameraOn,
    cameraError,
    startCamera,
    calibration,
    beginCalibrationFlow,
    resetCalibration,
    myObstacle,
    connected,
    role,
    versusState,
    error,
    createMatch,
    joinMatch,
    restartMatch,
    leaveMatch,
  } = game;

  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  const inMatch = Boolean(role && versusState);
  const vstate = versusState?.state;
  const bothPresent = versusState
    ? Object.keys(versusState.players).length === 2
    : false;
  const me = role && versusState ? versusState.players[role] : undefined;
  const calibrating = calibration.status === "collecting";

  // Start the camera once both players are in the lobby so calibration can run.
  useEffect(() => {
    if (vstate === "LOBBY" && bothPresent && !cameraOn && !me?.ready) {
      void startCamera();
    }
  }, [vstate, bothPresent, cameraOn, me?.ready, startCamera]);

  // Auto-begin calibration once the camera is up and the player is in frame.
  useEffect(() => {
    if (
      vstate === "LOBBY" &&
      bothPresent &&
      cameraOn &&
      !me?.ready &&
      confidence >= CALIBRATION_CONFIDENCE_GATE &&
      calibration.status === "idle"
    ) {
      beginCalibrationFlow();
    }
  }, [
    vstate,
    bothPresent,
    cameraOn,
    me?.ready,
    confidence,
    calibration.status,
    beginCalibrationFlow,
  ]);

  const handleLeave = useCallback(() => {
    leaveMatch();
    resetCalibration();
    navigate("/");
  }, [leaveMatch, resetCalibration, navigate]);

  const handleRematch = useCallback(() => {
    resetCalibration();
    restartMatch();
  }, [resetCalibration, restartMatch]);

  const countdown =
    versusState?.countdownEndsAt && versusState.countdownEndsAt > now
      ? Math.ceil((versusState.countdownEndsAt - now) / 1000)
      : 0;

  if (!inMatch || !role || !versusState) {
    return (
      <VersusLobby
        connected={connected}
        error={error}
        onCreate={createMatch}
        onJoin={joinMatch}
        onBack={() => navigate("/")}
      />
    );
  }

  return (
    <main className="relative min-h-screen bg-neutral-950 text-neutral-100">
      {/* Hidden video keeps MediaPipe streaming for the whole match. */}
      <video ref={videoRef} className="hidden" playsInline muted />

      <div className="relative h-screen w-screen overflow-hidden bg-black">
        <canvas
          ref={canvasRef}
          className="h-full w-full -scale-x-100 object-cover"
        />

        {vstate === "RUNNING" ? (
          <>
            <VersusHud state={versusState} myRole={role} />
            <div className="pointer-events-none absolute inset-x-0 top-1/4 z-10 flex justify-center">
              <ObstaclePrompt obstacle={myObstacle} now={now} />
            </div>
          </>
        ) : null}

        {vstate === "LOBBY" && calibrating ? (
          <CalibratingOverlay
            progress={calibration.progress}
            samples={calibration.sampleCount}
          />
        ) : null}

        {vstate === "LOBBY" && !calibrating ? (
          <VersusWaiting
            state={versusState}
            myRole={role}
            cameraOn={cameraOn}
            confidence={confidence}
            cameraError={cameraError}
            onCalibrate={beginCalibrationFlow}
            onLeave={handleLeave}
          />
        ) : null}

        {vstate === "COUNTDOWN" ? <CountdownOverlay value={countdown} /> : null}

        {vstate === "FINISHED" ? (
          <VersusResult
            state={versusState}
            myRole={role}
            onRematch={handleRematch}
            onLeave={handleLeave}
          />
        ) : null}
      </div>
    </main>
  );
}
