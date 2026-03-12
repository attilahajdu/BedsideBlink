package com.bedsideblink

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.speech.tts.TextToSpeech
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Handles all audio: beeps, chirps, and TTS.
 */
class AudioFeedback(private val context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    var volume: Float = 1f
        set(value) { field = value.coerceIn(0f, 1f) }

    private var tts: TextToSpeech? = null
    private var ttsReady = false

    init {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                ttsReady = true
            }
        }
    }

    fun playStateChangeBeep() {
        playTone(ToneGenerator.TONE_PROP_BEEP, 200)
    }

    fun playBlinkChirp() {
        playTone(ToneGenerator.TONE_PROP_BEEP2, 300)
    }

    private fun playTone(toneType: Int, durationMs: Int) {
        scope.launch {
            try {
                val vol = (volume * 100).toInt().coerceIn(0, 100)
                val toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, vol)
                toneGen.startTone(toneType, durationMs)
                delay(durationMs.toLong() + 50)
                toneGen.release()
            } catch (e: Exception) {
                Log.e("BedsideBlink", "Beep failed", e)
            }
        }
    }

    fun speak(text: String) {
        scope.launch {
            if (ttsReady && tts != null) {
                tts?.setSpeechRate(0.9f)
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
            }
        }
    }

    fun release() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}
