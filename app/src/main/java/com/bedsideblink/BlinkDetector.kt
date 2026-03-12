package com.bedsideblink

/**
 * Detects long blinks from eyes-open probability.
 * Uses min(leftEyeProb, rightEyeProb) < 0.3 for 700ms to trigger.
 */
sealed class BlinkState {
    data object Normal : BlinkState()
    data object Blinking : BlinkState()
    data object BlinkDetected : BlinkState()
    data object Cooldown : BlinkState()
}

class BlinkDetector {
    private var blinkStart = 0L
    private var cooldownUntil = 0L
    private val blinkMs = 700L
    private val cooldownMs = 2500L

    /**
     * @param eyesOpenProb Combined probability (use min(left, right) from ML Kit)
     */
    fun processEyesOpenProb(eyesOpenProb: Float): BlinkState {
        val now = System.currentTimeMillis()
        if (now < cooldownUntil) return BlinkState.Cooldown

        return when {
            eyesOpenProb < 0.3f -> {
                if (blinkStart == 0L) blinkStart = now
                when {
                    now - blinkStart >= blinkMs -> {
                        cooldownUntil = now + cooldownMs
                        blinkStart = 0L
                        BlinkState.BlinkDetected
                    }
                    else -> BlinkState.Blinking
                }
            }
            else -> {
                blinkStart = 0L
                BlinkState.Normal
            }
        }
    }
}
