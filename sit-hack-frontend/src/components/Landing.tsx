import { motion } from "framer-motion";
import { Music, VolumeX } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

const ZOMBIE_FONT = "Zombie";
const MAX_FACE_BYTES = 1024 * 1024; // 1 MB

const HEAD_PRESETS: Array<{ path: string; label: string }> = [
  { path: "/balle.png", label: "Balle" },
  { path: "/tung.png", label: "Tung" },
  { path: "/tralala.png", label: "Tralala" },
];

interface LandingProps {
  connected: boolean;
  onStart: () => void;
  onVersus: () => void;
  zombieFace: string | null;
  headAvatar: string | null;
  onZombieFaceChange: (value: string | null) => void;
  onHeadAvatarChange: (value: string | null) => void;
}

export function Landing({
  connected,
  onStart,
  onVersus,
  zombieFace,
  headAvatar,
  onZombieFaceChange,
  onHeadAvatarChange,
}: LandingProps) {
  const [musicOn, setMusicOn] = useState(false);
  const [showZombieModal, setShowZombieModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFaceFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) {
      return;
    }

    const validExtension = /\.(png|jpe?g)$/i.test(file.name);
    const validType = ["image/png", "image/jpeg"].includes(file.type);
    if (!validExtension && !validType) {
      setFaceError("Only PNG, JPG, or JPEG files are allowed.");
      return;
    }
    if (file.size >= MAX_FACE_BYTES) {
      setFaceError("Image must be less than 1 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onZombieFaceChange(
        typeof reader.result === "string" ? reader.result : null,
      );
      setFaceError(null);
    };
    reader.onerror = () =>
      setFaceError("Could not read that file. Try another one.");
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="relative flex min-h-screen flex-col justify-between overflow-hidden px-4 py-12 text-neutral-100"
      style={{
        backgroundImage: "url('/bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* <div className="scanlines pointer-events-none absolute inset-0 opacity-30" /> */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(132,204,22,0.18),transparent_60%)]" />

      {/* Music toggle — top right */}
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={() => setMusicOn((v) => !v)}
          className="w-10 h-10 rounded-full bg-[#086972]/80 border border-[#17b978]/40 hover:border-[#17b978] hover:bg-[#17b978]/20 transition-all flex items-center justify-center"
          title={musicOn ? "Turn music off" : "Turn music on"}
        >
          {musicOn ? (
            <Music size={18} className="text-[#a7ff83]" />
          ) : (
            <VolumeX size={18} className="text-[#17b978]/50" />
          )}
        </button>
      </div>

      {/* Customize zombie face — bottom left */}
      <div className="absolute bottom-4 left-8 z-30">
        <button
          onClick={() => setShowZombieModal(true)}
          className="w-27 h-27 rounded-full border-2 border-[#17b978]/50 bg-[#086972]/80 hover:bg-[#17b978]/20 hover:border-[#17b978] transition-all hover:scale-110 flex items-center justify-center px-3"
          style={{
            fontFamily: ZOMBIE_FONT,
            fontSize: "1.15rem",
            color: "#a7ff83",
            lineHeight: 1.2,
          }}
        >
          <span className="text-center">Customize zombie face</span>
        </button>
      </div>

      {/* Customize head zombie — bottom right */}
      <div className="absolute bottom-4 right-8 z-30">
        <button
          onClick={() => setShowAvatarModal(true)}
          className="w-27 h-27 rounded-full border-2 border-[#17b978]/50 bg-[#086972]/80 hover:bg-[#17b978]/20 hover:border-[#17b978] transition-all hover:scale-110 flex items-center justify-center px-3"
          style={{
            fontFamily: ZOMBIE_FONT,
            fontSize: "1.15rem",
            color: "#a7ff83",
            lineHeight: 1.2,
          }}
        >
          <span className="text-center">Customize head zombie</span>
        </button>
      </div>

      {/* Title — above the running man */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center gap-3 text-center mt-3"
      >
        <span className="rounded-full border border-lime-500/40 bg-lime-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-lime-300">
          SIT HACK 2026
        </span>
        <h1 className="zombie-title text-[100px] sm:text-[100px] md:text-[120px] lg:text-[145px]">
          ZOMBIE RUN
        </h1>
      </motion.div>

      {/* Info + start — below the running man */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center gap-6 text-center mb-8 md:mb-8 lg:mb-8"
      >
        <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/70 px-5 py-3 text-sm text-neutral-300">
          <span className="text-2xl">🧟</span>
          <span>
            The horde starts slow, then gets faster the longer you survive.
          </span>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onStart}
            disabled={!connected}
            className="rounded-xl px-10 py-4 transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background:
                "linear-gradient(180deg, #a7ff83 0%, #17b978 60%, #0d9460 100%)",
              boxShadow: "0 6px 0 #065e3f, 0 0 30px rgba(23,185,120,0.5)",
            }}
          >
            <span
              style={{
                fontFamily: "Zombie",
                fontSize: "2.5rem",
                color: "#083339",
                letterSpacing: "0.05em",
                lineHeight: 1,
              }}
            >
              {connected ? "START RUNNING" : "CONNECTING..."}
            </span>
          </button>

          <button
            type="button"
            onClick={onVersus}
            disabled={!connected}
            className="rounded-xl border-2 border-[#17b978] px-8 py-4 transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: "rgba(8, 51, 57, 0.6)",
              boxShadow: "0 0 24px rgba(23,185,120,0.35)",
            }}
          >
            <span
              style={{
                fontFamily: "Zombie",
                fontSize: "2.5rem",
                color: "#a7ff83",
                letterSpacing: "0.05em",
                lineHeight: 1,
              }}
            >
              2-PLAYER VERSUS
            </span>
          </button>
        </div>
      </motion.div>

      {/* Customize zombie face modal */}
      {showZombieModal ? (
        <CustomizeModal
          title="Customize zombie face"
          subtitle="Upload a PNG / JPG / JPEG under 1 MB. It replaces the face of the four side zombies."
          onClose={() => {
            setShowZombieModal(false);
            setFaceError(null);
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full border-2 border-[#17b978]/50 bg-[#083339]">
              {zombieFace ? (
                <img
                  src={zombieFace}
                  alt="Zombie face preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-5xl">🧟</span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={handleFaceFile}
              className="hidden"
            />

            {faceError ? (
              <p className="text-sm text-red-400">{faceError}</p>
            ) : null}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <ModalButton onClick={() => fileInputRef.current?.click()}>
                {zombieFace ? "Choose another" : "Upload image"}
              </ModalButton>
              {zombieFace ? (
                <ModalButton
                  variant="ghost"
                  onClick={() => {
                    onZombieFaceChange(null);
                    setFaceError(null);
                  }}
                >
                  Reset to default
                </ModalButton>
              ) : null}
            </div>
          </div>
        </CustomizeModal>
      ) : null}

      {/* Customize head zombie modal */}
      {showAvatarModal ? (
        <CustomizeModal
          title="Customize head zombie"
          subtitle="Pick a preset to replace the zombie in the middle of the horde."
          onClose={() => setShowAvatarModal(false)}
        >
          <div className="flex flex-col items-center gap-5">
            <div className="grid grid-cols-3 gap-4">
              {HEAD_PRESETS.map((preset) => {
                const active = headAvatar === preset.path;
                return (
                  <button
                    key={preset.path}
                    type="button"
                    onClick={() => onHeadAvatarChange(preset.path)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${
                      active
                        ? "border-[#a7ff83] bg-[#17b978]/20"
                        : "border-[#17b978]/40 bg-[#083339]/60 hover:border-[#17b978]"
                    }`}
                  >
                    <img
                      src={preset.path}
                      alt={preset.label}
                      className="h-20 w-20 object-contain"
                    />
                    <span className="text-xs uppercase tracking-widest text-[#a7ff83]">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {headAvatar ? (
              <ModalButton
                variant="ghost"
                onClick={() => onHeadAvatarChange(null)}
              >
                Reset to default
              </ModalButton>
            ) : null}
          </div>
        </CustomizeModal>
      ) : null}
    </div>
  );
}

function CustomizeModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border-2 border-[#17b978]/50 bg-[#04201f]/95 p-6 shadow-[0_0_40px_-6px_rgba(23,185,120,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-2xl leading-none text-[#17b978] hover:text-[#a7ff83]"
          title="Close"
        >
          ×
        </button>
        <h2
          className="mb-1 text-center text-3xl"
          style={{ fontFamily: ZOMBIE_FONT, color: "#a7ff83" }}
        >
          {title}
        </h2>
        <p className="mb-5 text-center text-sm text-neutral-400">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function ModalButton({
  children,
  onClick,
  variant = "solid",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "solid" | "ghost";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        variant === "solid"
          ? "rounded-xl bg-[#17b978] px-5 py-2.5 text-sm font-bold uppercase tracking-widest text-[#04201f] transition hover:bg-[#a7ff83]"
          : "rounded-xl border border-[#17b978]/50 px-5 py-2.5 text-sm font-bold uppercase tracking-widest text-[#a7ff83] transition hover:border-[#17b978]"
      }
    >
      {children}
    </button>
  );
}
