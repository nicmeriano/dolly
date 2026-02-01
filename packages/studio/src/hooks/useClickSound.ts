import { useRef, useEffect } from "react";
import { useStudio } from "../context/StudioContext";
import { getFileUrl } from "../lib/api-client";

/**
 * Plays click sounds in canvas preview mode by syncing to video currentTime.
 * Loads the click WAV from the server and uses Web Audio API for low-latency playback.
 */
export function useClickSound(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const { state } = useStudio();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const playedRef = useRef<Set<number>>(new Set());
  const rafRef = useRef<number>(0);

  // Load click sound buffer
  useEffect(() => {
    let cancelled = false;

    async function loadSound() {
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const response = await fetch(getFileUrl("click.wav"));
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;
        bufferRef.current = audioBuffer;
      } catch {
        // Click sound not available — silent fallback
      }
    }

    loadSound();
    return () => {
      cancelled = true;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      bufferRef.current = null;
    };
  }, []);

  // Sync click playback with video time
  useEffect(() => {
    const recording = state.recording;
    if (!recording) return;

    const clickKeyframes = recording.keyframes.keyframes.filter(
      (kf) => kf.type === "click",
    );
    if (clickKeyframes.length === 0) return;

    function tick() {
      rafRef.current = requestAnimationFrame(tick);

      const video = videoRef.current;
      const ctx = audioCtxRef.current;
      const buffer = bufferRef.current;
      if (!video || !ctx || !buffer || !recording) return;
      if (video.paused || !recording.postProduction.audio.clickSound) return;

      const timeMs = video.currentTime * 1000;

      for (const kf of clickKeyframes) {
        // Play click if we're within 50ms after the click timestamp and haven't played it yet
        if (timeMs >= kf.timestamp && timeMs < kf.timestamp + 50 && !playedRef.current.has(kf.timestamp)) {
          playedRef.current.add(kf.timestamp);

          const source = ctx.createBufferSource();
          source.buffer = buffer;

          const gain = ctx.createGain();
          gain.gain.value = recording.postProduction.audio.volume;

          source.connect(gain);
          gain.connect(ctx.destination);
          source.start();
        }
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.recording, videoRef]);

  // Reset played clicks on seek
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onSeeked() {
      playedRef.current.clear();
    }

    video.addEventListener("seeked", onSeeked);
    return () => video.removeEventListener("seeked", onSeeked);
  }, [videoRef]);
}
