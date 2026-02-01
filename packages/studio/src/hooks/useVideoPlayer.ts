import { useRef, useCallback, useEffect } from "react";
import { useStudio } from "../context/StudioContext";

export function useVideoPlayer() {
  const { state, dispatch } = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);

  const updateTime = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      dispatch({
        type: "SET_PLAYER_STATE",
        player: { currentTime: video.currentTime },
      });
    }
    if (state.player.playing) {
      rafRef.current = requestAnimationFrame(updateTime);
    }
  }, [state.player.playing, dispatch]);

  useEffect(() => {
    if (state.player.playing) {
      rafRef.current = requestAnimationFrame(updateTime);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.player.playing, updateTime]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.play();
      dispatch({ type: "SET_PLAYER_STATE", player: { playing: true } });
    }
  }, [dispatch]);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      dispatch({ type: "SET_PLAYER_STATE", player: { playing: false } });
    }
  }, [dispatch]);

  const togglePlay = useCallback(() => {
    if (state.player.playing) {
      pause();
    } else {
      play();
    }
  }, [state.player.playing, play, pause]);

  const seek = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (video) {
        video.currentTime = time;
        dispatch({ type: "SET_PLAYER_STATE", player: { currentTime: time } });
      }
    },
    [dispatch],
  );

  const seekRelative = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (video) {
        const newTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
        video.currentTime = newTime;
        dispatch({ type: "SET_PLAYER_STATE", player: { currentTime: newTime } });
      }
    },
    [dispatch],
  );

  const onVideoLoaded = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      dispatch({
        type: "SET_PLAYER_STATE",
        player: { duration: video.duration },
      });
    }
  }, [dispatch]);

  const onVideoEnded = useCallback(() => {
    dispatch({ type: "SET_PLAYER_STATE", player: { playing: false } });
  }, [dispatch]);

  return {
    videoRef,
    play,
    pause,
    togglePlay,
    seek,
    seekRelative,
    onVideoLoaded,
    onVideoEnded,
  };
}
