// useStreamHandler.js
// Custom React hook that registers and manages the three streaming IPC events:
//   chat:stream:start  — creates a new streaming message in state
//   chat:stream:chunk  — appends each token to the streaming message
//   chat:stream:end    — finalises the message, triggers TTS auto-play and follow-up pills
//
// MODIFIED: Added support for auto-advance messages and teacher proactive teaching callbacks
// MODIFIED: Fixed proactive message creation to respect teachingModel from metadata
// FIXED: Improved chunk handling to ensure messages are updated
// FIXED: Fixed auto-advance logic to actually trigger lesson advancement
// FIXED: Fixed duplicate chunk issue by preventing multiple listener registrations
// FIXED: Added safety checks for undefined data in stream end handler
// FIXED: Added try-catch to all setTimeout callbacks to capture async errors
// FIXED: Added detailed error logging to identify exact error location
// FIXED: Added module-level variable to ensure listeners are only registered once
// FIXED: Added isStreamingActiveRef to prevent concurrent streams
// FIXED: Added stream ID tracking to prevent duplicate processing
// FIXED: Added detailed logging for stream end events to debug "Stream ended with no data" error
// FIXED: Enhanced error handling with more context

import { useEffect, useRef } from 'react';
import ipc from '../ipc';
import { MAX_HISTORY } from './chatUtils';

// NOTE: The module-level listenersRegistered guard has been removed.
// Listener lifecycle is now managed correctly by preload.js, which stores
// each wrapper reference and removes only that specific listener on cleanup.
// The guard was causing listeners to never re-register after a cleanup cycle.

/**
 * @param {object} params
 * @param {Function} params.setMessages        — React state setter for messages array
 * @param {Function} params.setIsTyping        — React state setter for typing indicator
 * @param {Function} params.setIsStreaming     — React state setter for streaming flag
 * @param {boolean}  params.autoPlayTTS        — whether to auto-play TTS on welcome messages
 * @param {Set}      params.playedMessageIds   — set of message IDs already auto-played
 * @param {string}   params.activeSubject      — current subject ID (kept fresh via ref)
 * @param {Function} params.generateFollowUps  — async fn(messageId, responseText) → void
 * @param {Function} params.onAutoAdvance      — callback for auto-advance messages
 * @param {Function} params.onTeacherProactive — callback for teacher proactive messages
 */
export function useStreamHandler({
  setMessages,
  setIsTyping,
  setIsStreaming,
  setFeedbackToast,
  setLessonDialog,
  setTestQuestionDialog,
  setTestFeedback,
  setTestQuestionStreamingContent,  // NEW: streams chunks into the open test dialog
  setLessonDialogStreamingContent,  // NEW: streams chunks into the open lesson dialog
  autoPlayTTS,
  playedMessageIds,
  activeSubject,
  generateFollowUps,
  onAutoAdvance,
  onTeacherProactive,
  onStreamStart,
  onStreamEnd,
  onGenerationProgress,
}) {
  // Ref holds the latest values of every callback/prop so the effect closure
  // (which only runs once) never reads stale values.
  const streamCallbacksRef = useRef(null);
  streamCallbacksRef.current = {
    setMessages,
    setIsTyping,
    setIsStreaming,
    setFeedbackToast,
    setLessonDialog,
    setTestQuestionDialog,
    setTestFeedback,
    setTestQuestionStreamingContent,
    setLessonDialogStreamingContent,
    autoPlayTTS,
    playedMessageIds,
    activeSubject,
    generateFollowUps,
    onAutoAdvance,
    onTeacherProactive,
    onStreamStart,
    onStreamEnd,
    onGenerationProgress,
  };

  // Keep track of auto-advance timeouts to clear them on unmount
  const autoAdvanceTimeoutsRef = useRef([]);

  // Use a ref to track if listeners have been registered (组件级，用于清理)
  const listenersRegisteredRef = useRef(false);

  // ===== 添加标志来跟踪当前是否有活跃的流 =====
  const isStreamingActiveRef = useRef(false);
  // ===== END =====

  // ===== 添加当前消息ID跟踪 =====
  const currentMessageIdRef = useRef(null);
  // ===== END =====

  // Stores lesson dialog metadata at stream:start; opened at stream:end with fullText
  const pendingLessonDialogRef = useRef(null);

  // Stores test question metadata at stream:start; opened at stream:end with fullText
  const pendingTestQuestionRef = useRef(null);

  useEffect(() => {
    console.log('[useStreamHandler] Setting up stream listeners');

    // Use persistent listeners (ipc.on) so every streaming response —
    // including auto-advance and resume — is captured, not just the first one.
    // ipc.on returns an unsubscribe fn; collect for cleanup on unmount.
    const unsubs = [];
    const listen = (channel, handler) => {
      console.log(`[useStreamHandler] Registering listener for: ${channel}`);
      if (typeof ipc.on === 'function') {
        // Persistent listener — preferred path
        const unsub = ipc.on(channel, handler);
        if (typeof unsub === 'function') unsubs.push(unsub);
      } else {
        // onOnce fallback: re-registers itself after each fire so future
        // streams are still handled even when ipc.on is unavailable.
        const reRegister = (args) => {
          handler(args);
          ipc.onOnce(channel, reRegister);
        };
        ipc.onOnce(channel, reRegister);
      }
    };

    // ── chat:stream:start ──────────────────────────────────────
    // A new streaming response is beginning. Insert a blank streaming message.
    listen('chat:stream:start', (meta) => {
      console.log('[useStreamHandler] ===== STREAM START RECEIVED =====', meta);

      // ===== Stream guard: if a stream is already active, finalize it and start the new one =====
      // Do NOT block — answer_feedback and test_question arrive in rapid succession.
      // Blocking here caused Q2 to never appear (its stream:start was dropped entirely).
      if (isStreamingActiveRef.current) {
        console.log('[useStreamHandler] New stream while active — finalizing previous:', currentMessageIdRef.current, '→', meta.type);
        const { setMessages: sm } = streamCallbacksRef.current;
        sm(prev => {
          const last = prev[prev.length - 1];
          if (last && last.streaming) {
            return [...prev.slice(0, -1), { ...last, streaming: false }];
          }
          return prev;
        });
      }
      isStreamingActiveRef.current = true;
      pendingLessonDialogRef.current = null; // clear stale pending dialog on each new stream
      pendingTestQuestionRef.current = null;   // clear stale pending test question
      // ===== END =====

      console.log('[useStreamHandler] meta.proactive:', meta.proactive);
      console.log('[useStreamHandler] meta.phase:', meta.phase);
      console.log('[useStreamHandler] meta.subPhase:', meta.subPhase);
      console.log('[useStreamHandler] meta.autoAdvance:', meta.autoAdvance);
      console.log('[useStreamHandler] meta.delay:', meta.delay);
      console.log('[useStreamHandler] meta.teachingModel:', meta.teachingModel);

      console.log('[useStreamHandler] Full meta object:', JSON.stringify(meta, null, 2));

      const { setMessages, setIsTyping, onTeacherProactive, onStreamStart } = streamCallbacksRef.current;

      // Fire onStreamStart so ChatWindow can update teachingPhase/subPhase state
      if (onStreamStart) {
        console.log('[useStreamHandler] Calling onStreamStart with:', meta);
        onStreamStart(meta);
      }

      // Check if this is a proactive message (could be teacher-led OR test-led)
      if (meta.proactive) {
        console.log('[useStreamHandler] Creating proactive message with model:', meta.teachingModel);

        // ── Dialog intercepts — must happen BEFORE setMessages/proactiveMsg creation ──
        // These message types are handled by modal dialogs, not chat bubbles.
        // Intercepting early prevents duplicate setMessages calls and streaming:true
        // messages being added to the array (which blocks chunks).

        if (meta.type === 'test_question') {
          // Clear stale feedback from the previous question before opening new dialog
          const { setTestFeedback: stfClear, setTestQuestionDialog: stqdOpen } = streamCallbacksRef.current;
          if (stfClear) stfClear(null);

          // TRUE STREAMING: Open the dialog immediately with empty content,
          // then stream each chunk into it via setTestQuestionStreamingContent.
          // The question object already has metadata (topic, marks, difficulty)
          // from stream:start meta — only the .text field streams in.
          if (stqdOpen) {
            stqdOpen({
              question: {
                ...(meta.question || {}),
                text: '',         // starts empty — chunks fill it in
              },
              questionIndex:  meta.questionIndex  || 1,
              totalQuestions: meta.totalQuestions || 1,
              streaming: true,    // tells dialog to show streaming cursor
            });
          }

          // Mark as streaming dialog — chunks go to dialog, not chat
          pendingTestQuestionRef.current = {
            question:       meta.question || null,
            questionIndex:  meta.questionIndex  || 1,
            totalQuestions: meta.totalQuestions || 1,
            isStreamingDialog: true,   // NEW flag
          };
          // Fall through to onTeacherProactive/onStreamStart but skip setMessages entirely
        } else if (meta.type === 'answer_feedback') {
          // Route feedback into the open test dialog.
          // Auto-advance is suppressed (see stream:end) — lesson:advance is called
          // manually by ChatWindow when the student clicks "Next Question →".
          const { setTestFeedback: stf } = streamCallbacksRef.current;
          if (stf) stf({
            isCorrect:        meta.isCorrect,
            detailedFeedback: meta.detailedFeedback || null,
            workedSolution:   meta.workedSolution   || null,
          });
          // Signal that this stream should not auto-advance
          pendingTestQuestionRef.current = { suppressAutoAdvance: true };
        } else if (meta.type === 'test_complete' || meta.type === 'diagnosis') {
          // Test is over — close the question dialog and clear feedback immediately,
          // then create a chat bubble so the results message appears in the chat.
          const { setTestQuestionDialog: stqd, setTestFeedback: stf } = streamCallbacksRef.current;
          if (stqd) stqd(null);
          if (stf)  stf(null);

          // Create the streaming chat bubble for the results/diagnosis message
          const messageId = `msg-${meta.teachingModel || 'test-led'}-${Date.now()}-${Math.random()}`;
          currentMessageIdRef.current = messageId;
          setMessages(prev => {
            const hasStreaming = prev.some(msg => msg.streaming);
            if (hasStreaming) return prev;
            return [...prev, {
              role: 'assistant',
              teachingModel: meta.teachingModel || 'test-led',
              proactive: true,
              phase: meta.phase,
              subPhase: meta.subPhase,
              content: '',
              streaming: true,
              id: messageId,
              autoAdvance: meta.autoAdvance,
              delay: meta.delay,
              suggestions: meta.suggestions || null,
              results: meta.results || null,
              diagnosis: meta.diagnosis || null,
              timestamp: Date.now(),
              ...meta
            }].slice(-MAX_HISTORY);
          });
        } else if (meta.type === 'section_start' || meta.type === 'check_next' || meta.type === 'check_complete') {
          // TRUE STREAMING: Open the lesson dialog immediately with empty content,
          // then stream each chunk into it via setLessonDialogStreamingContent.
          const isCheckPhase = meta.phase === 'check' || meta.phase === 'checking' || meta.type === 'check_next';
          const dialogMeta = {
            phase:          meta.phase || 'introducing',
            subPhase:       meta.subPhase,
            sectionLabel:   meta.section || meta.phase || 'Lesson',
            topic:          meta.topic,
            questionIndex:  meta.questionIndex  || null,
            totalQuestions: meta.totalQuestions || null,
            isCheckPhase,
            content:        '',     // starts empty — chunks fill it in
            streaming:      true,   // tells dialog to show streaming cursor
          };

          const { setLessonDialog: sldOpen } = streamCallbacksRef.current;
          if (sldOpen) sldOpen(dialogMeta);

          // Keep ref so stream:end can finalize
          pendingLessonDialogRef.current = { ...dialogMeta, isStreamingDialog: true };
        } else {
          // All other proactive types → add as a streaming message to the chat

        try {
            // Create a proactive message (respects the teachingModel from metadata)
            setMessages(prev => {
              console.log('[useStreamHandler] Current messages count:', prev.length);

              // Check if we already have a streaming proactive message to avoid duplicates
              const hasStreamingProactive = prev.some(msg =>
                msg.streaming && msg.proactive && msg.phase === meta.phase
              );

              if (hasStreamingProactive) {
                console.log('[useStreamHandler] Already have a streaming proactive message, not creating duplicate');
                return prev;
              }

              const messageId = `msg-${meta.teachingModel || 'proactive'}-${Date.now()}-${Math.random()}`;
              currentMessageIdRef.current = messageId;

              const proactiveMsg = {
                role: 'assistant',
                teachingModel: meta.teachingModel || 'teacher-led',
                proactive: true,
                phase: meta.phase,
                subPhase: meta.subPhase,
                content: '',
                skillsUsed: meta.skillUsed ? [meta.skillUsed] : [],
                syllabusPoint: meta.syllabusPoint || null,
                visualization: meta.visualization || null,
                timestamp: Date.now(),
                streaming: true,
                id: messageId,
                exercise: meta.exercise || null,
                expectedAnswer: meta.expectedAnswer || null,
                autoAdvance: meta.autoAdvance,
                delay: meta.delay,
                questionIndex: meta.questionIndex,
                totalQuestions: meta.totalQuestions,
                testType: meta.testType,
                topic: meta.topic,
                difficulty: meta.difficulty,
                marks: meta.marks,
                question: meta.question,
                ...meta
              };

              console.log('[useStreamHandler] Proactive message created:', proactiveMsg.id, 'type:', meta.type);

              return [...prev, proactiveMsg].slice(-MAX_HISTORY);
            });
        } catch (err) {
          console.error('[useStreamHandler] Error in setMessages:', err);
          console.error('[useStreamHandler] setMessages error stack:', err.stack);
        }
        } // end else (non-dialog proactive types)

        // Call proactive callback if provided (for teacher-led mode)
        if (onTeacherProactive) {
          console.log('[useStreamHandler] Calling onTeacherProactive with:', {
            phase: meta.phase,
            subPhase: meta.subPhase,
            topic: meta.topic,
            teachingModel: meta.teachingModel
          });
          onTeacherProactive({
            phase: meta.phase,
            subPhase: meta.subPhase,
            topic: meta.topic,
            teachingModel: meta.teachingModel // Pass the teaching model
          });
        }
      } else {
        // Normal assistant message (non-proactive)
        console.log('[useStreamHandler] Creating normal assistant message');
        setMessages(prev => {
          // Check if we already have a streaming message to avoid duplicates
          const hasStreaming = prev.some(msg => msg.streaming);
          if (hasStreaming) {
            console.log('[useStreamHandler] Already have a streaming message, not creating duplicate');
            return prev;
          }

          const messageId = `msg-stream-${Date.now()}-${Math.random()}`;
          currentMessageIdRef.current = messageId;

          const streamingMsg = {
            role: 'assistant',
            content: '',
            skillsUsed: meta.skillUsed ? [meta.skillUsed] : [],
            syllabusPoint: meta.syllabusPoint || null,
            visualization: meta.visualization || null,
            timestamp: Date.now(),
            streaming: true,
            id: messageId,
            // Include teaching model if present
            teachingModel: meta.teachingModel,
            // Include any other metadata
            ...meta
          };
          console.log('[useStreamHandler] Normal message created:', streamingMsg.id);
          return [...prev, streamingMsg].slice(-MAX_HISTORY);
        });
      }

      setIsTyping(false);
      streamCallbacksRef.current.setIsStreaming(true);
    });

    // ── chat:stream:chunk ──────────────────────────────────────
    // A token has arrived. Route to the open streaming dialog or the last chat message.
    listen('chat:stream:chunk', (data) => {
      console.log('[useStreamHandler] ===== CHUNK RECEIVED =====', data);

      if (!isStreamingActiveRef.current) {
        console.log('[useStreamHandler] No active stream, ignoring chunk');
        return;
      }

      const { token } = data;
      const safeToken = token !== undefined ? token : '';

      // ── Route chunk to streaming dialog if one is open ──
      if (pendingTestQuestionRef.current?.isStreamingDialog) {
        const { setTestQuestionStreamingContent: stqsc } = streamCallbacksRef.current;
        if (stqsc) stqsc(prev => (prev || '') + safeToken);
        return;
      }
      if (pendingLessonDialogRef.current?.isStreamingDialog) {
        const { setLessonDialogStreamingContent: sldsc } = streamCallbacksRef.current;
        if (sldsc) sldsc(prev => (prev || '') + safeToken);
        return;
      }

      // ── Otherwise append to the last streaming chat message ──
      const { setMessages } = streamCallbacksRef.current;

      setMessages(prev => {
        if (!prev.length) {
          console.log('[useStreamHandler] No messages in state, ignoring chunk');
          return prev;
        }

        // Find the last streaming message (could be teacher, test, or normal)
        const lastIndex = prev.length - 1;
        const last = prev[lastIndex];

        console.log('[useStreamHandler] Last message:', {
          id: last.id,
          streaming: last.streaming,
          proactive: last.proactive,
          teachingModel: last.teachingModel,
          contentLength: last.content?.length || 0
        });

        if (!last.streaming) {
          console.log('[useStreamHandler] Last message not streaming, ignoring chunk');
          return prev;
        }

        const newContent = last.content + safeToken;
        console.log('[useStreamHandler] Appending chunk, new content length:', newContent.length);
        console.log('[useStreamHandler] Content preview:', newContent.substring(0, 50) + '...');

        // Create new message with updated content
        const updatedMessage = { ...last, content: newContent };
        const newMessages = [...prev.slice(0, -1), updatedMessage];

        return newMessages;
      });
    });

    // ── chat:stream:end ────────────────────────────────────────
    // Streaming is complete. Finalise the message, optionally auto-play TTS,
    // and kick off follow-up pill generation.
    listen('chat:stream:end', (data) => {
      console.log('[useStreamHandler] ===== STREAM END RECEIVED =====', data);

      // ===== ADD DETAILED LOGGING =====
      console.log('[useStreamHandler] Stream end data details:', {
        hasData: !!data,
        dataType: typeof data,
        dataKeys: data ? Object.keys(data) : [],
        hasError: data?.error,
        hasFullText: data?.fullText ? true : false,
        fullTextLength: data?.fullText?.length || 0,
        autoAdvance: data?.autoAdvance,
        messageId: data?.messageId
      });

      // ===== 检查是否有活跃的流 =====
      if (!isStreamingActiveRef.current) {
        console.log('[useStreamHandler] No active stream, ignoring end');
        return;
      }
      // ===== END =====

      // ===== FIX: Add try-catch to capture error details =====
      try {
        // ===== FIX: Add safety check for undefined data =====
        if (!data || typeof data !== 'object') {
          console.log('[useStreamHandler] Invalid data received in stream:end', data);
          isStreamingActiveRef.current = false;
          currentMessageIdRef.current = null;
          return;
        }
        // ===== END FIX =====

        const {
          setMessages,
          setIsTyping,
          autoPlayTTS,
          playedMessageIds,
          generateFollowUps,
          onAutoAdvance,
        } = streamCallbacksRef.current;

        const { fullText = '', error = null, autoAdvance = false, autoAdvanceDelay = 4000, proactiveComplete = false, messageId } = data;

        // NOTE: We do NOT check messageId here — the backend generates its own ID
        // while useStreamHandler generates a separate local ID for the message object.
        // These will never match, so any ID-based filtering would drop all stream:end events.

        // Store autoAdvance and delay values for later use
        let pendingAutoAdvance = autoAdvance;
        let pendingDelay = autoAdvanceDelay;

        setMessages(prev => {
          if (!prev.length) {
            console.log('[useStreamHandler] No messages in state, ignoring end');
            return prev;
          }

          const last = prev[prev.length - 1];
          console.log('[useStreamHandler] Last message before end:', {
            id: last.id,
            streaming: last.streaming,
            teachingModel: last.teachingModel,
            contentLength: last.content?.length || 0,
            contentPreview: last.content?.substring(0, 50) + '...',
            autoAdvance: last.autoAdvance,
            delay: last.delay
          });

          if (!last.streaming) {
            // Already finalized (by next stream's start guard) — no state update needed,
            // but we must NOT return here. setIsStreaming(false) still needs to run below.
            return prev;
          }

          let newMessage;
          if (error) {
            console.log('[useStreamHandler] Error in stream:', error);
            newMessage = {
              ...last,
              content: '⚠️ Connection error. Please check that a model is configured in Settings.',
              streaming: false,
            };
          } else {
            // Handle undefined fullText properly
            const finalContent = fullText !== undefined && fullText !== null && fullText !== ''
              ? fullText
              : (last.content || '');

            console.log('[useStreamHandler] Finalizing message:');
            console.log('[useStreamHandler]   - fullText provided:', fullText ? 'yes' : 'no');
            console.log('[useStreamHandler]   - last.content length:', last.content?.length || 0);
            console.log('[useStreamHandler]   - finalContent length:', finalContent.length);
            console.log('[useStreamHandler]   - finalContent preview:', finalContent.substring(0, 50) + '...');

            newMessage = {
              ...last,
              content: finalContent,
              streaming: false,
              id: last.id, // Keep the original ID
            };

            // Use autoAdvance from the message if not provided in end event
            if (pendingAutoAdvance === undefined && last.autoAdvance !== undefined) {
              pendingAutoAdvance = last.autoAdvance;
              console.log('[useStreamHandler] Using autoAdvance from message:', pendingAutoAdvance);
            }

            if (pendingDelay === undefined && last.delay !== undefined) {
              pendingDelay = last.delay;
              console.log('[useStreamHandler] Using delay from message:', pendingDelay);
            }
          }

          // Auto-play TTS if enabled and this is a welcome / fresh-start message
          setTimeout(() => {
            try {
              console.log('[useStreamHandler] TTS timeout executing for message:', newMessage.id);
              if (autoPlayTTS && !playedMessageIds.has(newMessage.id)) {
                const shouldAutoPlay =
                  newMessage.content?.startsWith('Fresh start') ||
                  newMessage.content?.startsWith("Hi! I'm **Tute**");

                if (shouldAutoPlay) {
                  playedMessageIds.add(newMessage.id);
                  const messageElement = document.querySelector(`[data-message-id="${newMessage.id}"]`);
                  if (messageElement) {
                    const ttsButton = messageElement.querySelector('.tts-button');
                    if (ttsButton) ttsButton.click();
                  }
                }
              }
            } catch (err) {
              console.error('[useStreamHandler] Error in TTS timeout:', err);
              console.error('[useStreamHandler] TTS error stack:', err.stack);
            }
          }, 500);

          // Generate follow-up pills for completed (non-error) assistant messages
          if (!error && newMessage.id && newMessage.content && !newMessage.proactive) {
            setTimeout(() => {
              try {
                console.log('[useStreamHandler] generateFollowUps timeout executing for message:', newMessage.id);
                generateFollowUps(newMessage.id, newMessage.content);
              } catch (err) {
                console.error('[useStreamHandler] Error in generateFollowUps timeout:', err);
                console.error('[useStreamHandler] generateFollowUps error stack:', err.stack);
              }
            }, 300);
          }

          return [...prev.slice(0, -1), newMessage];
        });

        // ===== FIXED: Handle auto-advance after message is finalized =====
        // Skip auto-advance if a lesson dialog is about to open — the Continue
        // button in the dialog calls lesson:advance manually instead.
        if (pendingAutoAdvance && pendingDelay && onAutoAdvance && !pendingLessonDialogRef.current && !pendingTestQuestionRef.current) {
          console.log('[useStreamHandler] ===== SCHEDULING AUTO-ADVANCE =====');
          console.log('[useStreamHandler] Delay:', pendingDelay, 'ms');
          console.log('[useStreamHandler] Will call onAutoAdvance with: { type: "next" }');

          const timeoutId = setTimeout(() => {
            try {
              console.log('[useStreamHandler] ===== AUTO-ADVANCE TIMEOUT FIRED =====');
              console.log('[useStreamHandler] Calling onAutoAdvance...');

              // 确保在调用自动前进之前流已经结束
              if (!isStreamingActiveRef.current) {
                onAutoAdvance({ type: 'next' });
              } else {
                console.log('[useStreamHandler] Stream still active, rescheduling auto-advance');
                const rescheduleId = setTimeout(() => {
                  onAutoAdvance({ type: 'next' });
                }, 1000);
                autoAdvanceTimeoutsRef.current.push(rescheduleId);
              }
            } catch (err) {
              console.error('[useStreamHandler] Error in auto-advance timeout:', err);
              console.error('[useStreamHandler] auto-advance error stack:', err.stack);
            }
          }, pendingDelay);

          // Store timeout for cleanup
          autoAdvanceTimeoutsRef.current.push(timeoutId);
        } else {
          console.log('[useStreamHandler] Auto-advance not scheduled:', {
            pendingAutoAdvance,
            pendingDelay,
            hasOnAutoAdvance: !!onAutoAdvance
          });
        }
        // ===== END FIX =====

        // Handle proactive message completion
        if (proactiveComplete && onAutoAdvance) {
          console.log('[useStreamHandler] Proactive message complete');
          onAutoAdvance({ type: 'proactive_complete' });
        }

        // Finalize streaming dialogs with the complete text and stop the cursor.
        if (pendingTestQuestionRef.current) {
          const pending = pendingTestQuestionRef.current;
          if (pending.suppressAutoAdvance) {
            // answer_feedback — nothing to finalize, just clear
          } else if (pending.isStreamingDialog) {
            // Streaming dialog already open — finalize: set streaming:false and lock in fullText
            const { setTestQuestionDialog: stqd, setTestQuestionStreamingContent: stqsc }
              = streamCallbacksRef.current;
            if (stqd) {
              stqd(prev => prev ? {
                ...prev,
                question: { ...prev.question, text: fullText || prev.question?.text || '' },
                streaming: false,
              } : prev);
            }
            if (stqsc) stqsc(null); // clear streaming buffer
          } else {
            // Fallback: dialog wasn't opened yet — open it now (legacy path)
            const { setTestQuestionDialog: stqd } = streamCallbacksRef.current;
            if (stqd && fullText) {
              stqd({
                question: pending.question
                  ? { ...pending.question, text: fullText }
                  : { text: fullText },
                questionIndex:  pending.questionIndex,
                totalQuestions: pending.totalQuestions,
                streaming: false,
              });
            }
          }
          pendingTestQuestionRef.current = null;
        }

        // Finalize streaming lesson dialog with complete content and stop the cursor.
        if (pendingLessonDialogRef.current) {
          const { setLessonDialog: sld, setLessonDialogStreamingContent: sldsc }
            = streamCallbacksRef.current;
          if (pendingLessonDialogRef.current.isStreamingDialog) {
            // Already open — finalize
            if (sld) {
              sld(prev => prev ? {
                ...prev,
                content:  fullText || prev.content || '',
                streaming: false,
              } : prev);
            }
            if (sldsc) sldsc(null);
          } else {
            // Fallback: open now
            if (sld && fullText) {
              sld({ ...pendingLessonDialogRef.current, content: fullText, streaming: false });
            }
          }
          pendingLessonDialogRef.current = null;
        }

        // Always reset streaming state — even if the message was already finalized
        // by the next stream's start guard. Skipping this leaves Stop button stuck.
        setIsTyping(false);
        streamCallbacksRef.current.setIsStreaming(false);
        isStreamingActiveRef.current = false;
        currentMessageIdRef.current = null;

        // Fire onStreamEnd so ChatWindow can react (e.g. load homework, clear generation state)
        const { onStreamEnd } = streamCallbacksRef.current;
        if (onStreamEnd) {
          console.log('[useStreamHandler] Calling onStreamEnd with fullText length:', fullText?.length || 0);
          onStreamEnd(fullText);
        }
      } catch (err) {
        console.error('[useStreamHandler] Error in stream:end handler:', err);
        console.error('[useStreamHandler] Error stack:', err.stack);
        console.error('[useStreamHandler] Error data:', data);

        // ===== 确保错误时也重置标志 =====
        isStreamingActiveRef.current = false;
        currentMessageIdRef.current = null;
        // ===== END =====
      }
    });

    // ── lesson:auto-advance event ─────────────────────────
    // Special event for lesson auto-advancement
    listen('lesson:auto-advance', ({ nextPhase, delay }) => {
      console.log('[useStreamHandler] lesson:auto-advance received:', nextPhase, delay);

      const { onAutoAdvance } = streamCallbacksRef.current;
      if (onAutoAdvance) {
        const timeoutId = setTimeout(() => {
          try {
            console.log('[useStreamHandler] lesson:auto-advance timeout executing');

            // 检查是否有活跃的流
            if (!isStreamingActiveRef.current) {
              onAutoAdvance({ type: 'phase_change', phase: nextPhase });
            } else {
              console.log('[useStreamHandler] Stream active, rescheduling phase change');
              const rescheduleId = setTimeout(() => {
                onAutoAdvance({ type: 'phase_change', phase: nextPhase });
              }, 1000);
              autoAdvanceTimeoutsRef.current.push(rescheduleId);
            }
          } catch (err) {
            console.error('[useStreamHandler] Error in lesson:auto-advance timeout:', err);
            console.error('[useStreamHandler] lesson:auto-advance error stack:', err.stack);
          }
        }, delay || 1000);

        autoAdvanceTimeoutsRef.current.push(timeoutId);
      }
    });

    // Cleanup: unsubscribe all persistent listeners on unmount
    return () => {
      console.log('[useStreamHandler] Cleaning up listeners and timeouts');

      // Clear all auto-advance timeouts
      autoAdvanceTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      autoAdvanceTimeoutsRef.current = [];

      // Unsubscribe all IPC listeners
      unsubs.forEach(fn => fn());

    };
  }, []); // Empty dependency array - runs only once on mount

  // Expose the ref so ChatWindow can read streamCallbacksRef.current if needed,
  // though typically callers only use the side-effects above.
  return streamCallbacksRef;
}