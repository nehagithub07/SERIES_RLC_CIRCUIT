import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import defaultAiGuideConfig from './aiGuideConfig.json';
import { isConfiguredAudioSource, loadAiGuideConfig } from './aiGuideConfigLoader.js';

const canUseSpeechSynthesis = () =>
  typeof window !== 'undefined' &&
  typeof window.speechSynthesis !== 'undefined' &&
  typeof window.SpeechSynthesisUtterance !== 'undefined';

const getSpeechLang = (locale) => {
  if (!locale) {
    return 'en-US';
  }
  return locale.includes('-') ? locale : `${locale}-US`;
};

export const useAiGuideNarration = ({
  config = defaultAiGuideConfig,
  locale,
  onError,
  onFinish,
  onStart,
} = {}) => {
  const guideConfig = useMemo(
    () => loadAiGuideConfig(config, locale ?? config?.defaultLocale),
    [config, locale]
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStepId, setActiveStepId] = useState(null);
  const currentPlaybackRef = useRef(null);
  const runIdRef = useRef(0);

  const stopCurrentPlayback = useCallback(() => {
    const currentPlayback = currentPlaybackRef.current;

    if (!currentPlayback) {
      return;
    }

    currentPlaybackRef.current = null;
    currentPlayback.stop();
  }, []);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    stopCurrentPlayback();
    setIsPlaying(false);
    setActiveStepId(null);
  }, [stopCurrentPlayback]);

  const speakText = useCallback(
    (text) =>
      new Promise((resolve, reject) => {
        if (!canUseSpeechSynthesis()) {
          reject(new Error('Speech synthesis is not available in this browser.'));
          return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        let settled = false;

        const settle = (callback) => {
          if (settled) {
            return;
          }
          settled = true;
          utterance.onend = null;
          utterance.onerror = null;

          if (currentPlaybackRef.current?.utterance === utterance) {
            currentPlaybackRef.current = null;
          }

          callback();
        };

        utterance.lang = getSpeechLang(guideConfig.locale);
        utterance.rate = 0.95;
        utterance.pitch = 1;

        utterance.onend = () => settle(resolve);
        utterance.onerror = (event) => {
          if (event.error === 'canceled' || event.error === 'interrupted') {
            settle(resolve);
            return;
          }
          settle(() => reject(new Error(`Speech synthesis failed: ${event.error}`)));
        };

        currentPlaybackRef.current = {
          stop: () => {
            settle(resolve);
            window.speechSynthesis.cancel();
          },
          utterance,
          };

        window.speechSynthesis.speak(utterance);
      }),
    [guideConfig.locale]
  );

  const playAudio = useCallback(
    (audioSource) =>
      new Promise((resolve, reject) => {
        // encodeURI seamlessly converts unusual characters or ellipses found in your file names (e.g., "...wav")
        const audioUrl = `/audio/${encodeURI(audioSource)}`;
        const audio = new Audio(audioUrl);

        let settled = false;

        const cleanup = () => {
          audio.removeEventListener('ended', handleEnded);
          audio.removeEventListener('error', handleError);
        };

        const settle = (callback) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();

          if (currentPlaybackRef.current?.audio === audio) {
            currentPlaybackRef.current = null;
          }

          callback();
        };

        const handleEnded = () => settle(resolve);
        const handleError = () => {
          console.error(
            `AI Guide: Cannot find audio file at ${audioUrl}. Did you move it to the public/audio folder?`
          );
          settle(() => reject(new Error(`Unable to play AI Guide audio: ${audioSource}`)));
        };

        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        currentPlaybackRef.current = {
          audio,
          stop: () => {
            audio.pause();
            audio.currentTime = 0;
            settle(resolve);
          },
        };

        audio.play().catch((error) => {
          console.warn('Browser blocked AI Guide Autoplay', error);
          settle(() => reject(error));
        });
      }),
    []
  );

  const executeStep = useCallback(
    async (step) => {
      if (isConfiguredAudioSource(step.audio)) {
        try {
          await playAudio(step.audio);
          return;
        } catch (error) {
          if (!step.text) {
            throw error;
          }
        }
      }
      await speakText(step.text);
    },
    [playAudio, speakText]
  );

  const playStep = useCallback(
    async (stepId) => {
      stop();

      const step = guideConfig.steps.find((s) => s.id === stepId);

      if (!step) {
        console.warn(`AI Guide: Step with id ${stepId} not found in configuration.`);
        return;
      }

      const runId = runIdRef.current + 1;
      runIdRef.current = runId;

      setIsPlaying(true);
      setActiveStepId(step.id);
      onStart?.(guideConfig);

      try {
        await executeStep(step);

        if (runIdRef.current === runId) {
          setIsPlaying(false);
          setActiveStepId(null);
          onFinish?.(guideConfig);
        }
      } catch (error) {
        if (runIdRef.current === runId) {
          setIsPlaying(false);
          setActiveStepId(null);
          onError?.(error);
        }
      }
    },
    [guideConfig, executeStep, stop, onStart, onFinish, onError]
  );

  const start = useCallback(async () => {
    stop();

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    if (guideConfig.steps.length === 0) {
      setIsPlaying(false);
      onError?.(new Error('AI Guide has no configured steps.'));
      return;
    }

    setIsPlaying(true);
    onStart?.(guideConfig);

    try {
      for (const step of guideConfig.steps) {
        if (runIdRef.current !== runId) {
          return;
        }
        setActiveStepId(step.id);
        await executeStep(step);
      }

      if (runIdRef.current === runId) {
        setIsPlaying(false);
        setActiveStepId(null);
        onFinish?.(guideConfig);
      }
    } catch (error) {
      if (runIdRef.current === runId) {
        setIsPlaying(false);
        setActiveStepId(null);
        onError?.(error);
      }
    }
  }, [guideConfig, onError, onFinish, onStart, executeStep, stop]);

  useEffect(() => stop, [stop]);

  return {
    activeStepId,
    config: guideConfig,
    isPlaying,
    start,
    playStep,
    stop,
  };
};
