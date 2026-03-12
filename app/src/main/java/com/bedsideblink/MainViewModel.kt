package com.bedsideblink

import android.app.Application
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class Screen {
    data object Calibration : Screen()
    data object RegionSelect : Screen()
    data object NeedSelect : Screen()
    data object Message : Screen()
}

data class AppState(
    val currentScreen: Screen = Screen.Calibration,
    val calibrationFaceDetectedSeconds: Float = 0f,
    val calibrationComplete: Boolean = false,
    val currentRegionIndex: Int = 0,
    val currentNeedIndex: Int = 0,
    val cycleCountdown: Int = 4,
    val selectedRegion: Region? = null,
    val selectedNeed: String? = null,
    val showSettings: Boolean = false,
    val cycleSpeedSeconds: Int = 4,
    val faceLostCountdownSeconds: Int? = null,
    val ttsVolume: Float = 1f,
    val faceDetected: Boolean = false,
    val faceBounds: android.graphics.Rect? = null
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(AppState())
    val state: StateFlow<AppState> = _state.asStateFlow()

    val blinkDetector = BlinkDetector()
    lateinit var cameraProcessor: CameraProcessor
    val audio = AudioFeedback(application)

    private var calibrationJob: Job? = null
    private var cycleJob: Job? = null
    private var faceLostJob: Job? = null
    private var lastFaceTime = 0L

    private val mainHandler = Handler(Looper.getMainLooper())

    fun initCameraProcessor(context: android.content.Context) {
        if (::cameraProcessor.isInitialized) return
        cameraProcessor = CameraProcessor(
            context = context,
            blinkDetector = blinkDetector,
            onBlinkDetected = { mainHandler.post { onBlinkDetected() } },
            onFaceDetected = { bounds -> mainHandler.post { onFaceDetected(bounds) } },
            onEyesOpenProb = { }
        )
    }

    fun onFaceDetected(bounds: android.graphics.Rect?) {
        val now = System.currentTimeMillis()
        val detected = bounds != null
        lastFaceTime = if (detected) now else lastFaceTime

        _state.value = _state.value.copy(
            faceDetected = detected,
            faceBounds = bounds
        )

        when (_state.value.currentScreen) {
            Screen.Calibration -> {
                if (detected) {
                    calibrationJob?.cancel()
                    calibrationJob = viewModelScope.launch {
                        var elapsed = _state.value.calibrationFaceDetectedSeconds
                        while (elapsed < 10f && _state.value.faceDetected) {
                            delay(100)
                            elapsed += 0.1f
                            _state.value = _state.value.copy(
                                calibrationFaceDetectedSeconds = elapsed
                            )
                            if (elapsed >= 10f) {
                                _state.value = _state.value.copy(calibrationComplete = true)
                                audio.playStateChangeBeep()
                            }
                        }
                    }
                } else {
                    calibrationJob?.cancel()
                    calibrationJob = null
                    _state.value = _state.value.copy(
                        calibrationFaceDetectedSeconds = 0f,
                        calibrationComplete = false
                    )
                }
            }
            Screen.RegionSelect, Screen.NeedSelect -> {
                if (detected) {
                    faceLostJob?.cancel()
                    _state.value = _state.value.copy(faceLostCountdownSeconds = null)
                } else {
                    startFaceLostCountdown()
                }
            }
            else -> { }
        }
    }

    private fun startFaceLostCountdown() {
        faceLostJob?.cancel()
        faceLostJob = viewModelScope.launch {
            for (s in 30 downTo 0) {
                if (_state.value.faceDetected) break
                _state.value = _state.value.copy(faceLostCountdownSeconds = s)
                delay(1000)
            }
            if (!_state.value.faceDetected) {
                _state.value = _state.value.copy(
                    currentScreen = Screen.Calibration,
                    calibrationFaceDetectedSeconds = 0f,
                    calibrationComplete = false,
                    faceLostCountdownSeconds = null
                )
                audio.playStateChangeBeep()
            }
        }
    }

    fun onBlinkDetected() {
        Log.d("BedsideBlink", "BLINK!")
        audio.playBlinkChirp()

        when (val s = _state.value.currentScreen) {
            Screen.RegionSelect -> {
                val region = REGIONS[_state.value.currentRegionIndex]
                _state.value = _state.value.copy(
                    currentScreen = Screen.NeedSelect,
                    selectedRegion = region,
                    currentNeedIndex = 0,
                    cycleCountdown = _state.value.cycleSpeedSeconds
                )
                startCycleJob(region.needs.size, isNeed = true)
                audio.playStateChangeBeep()
            }
            Screen.NeedSelect -> {
                val region = _state.value.selectedRegion!!
                val need = region.needs[_state.value.currentNeedIndex]
                cycleJob?.cancel()
                _state.value = _state.value.copy(
                    currentScreen = Screen.Message,
                    selectedNeed = need
                )
                audio.speak("Patient needs help. Region: ${region.label}. Need: $need")
                viewModelScope.launch {
                    delay(10_000)
                    if (_state.value.currentScreen == Screen.Message) {
                        onReset()
                    }
                }
            }
            else -> { }
        }
    }

    fun onStartPressed() {
        if (_state.value.calibrationComplete) {
            _state.value = _state.value.copy(
                currentScreen = Screen.RegionSelect,
                currentRegionIndex = 0,
                cycleCountdown = _state.value.cycleSpeedSeconds
            )
            startCycleJob(REGIONS.size, isNeed = false)
        }
    }

    private fun startCycleJob(size: Int, isNeed: Boolean) {
        cycleJob?.cancel()
        val speed = _state.value.cycleSpeedSeconds * 1000L
        cycleJob = viewModelScope.launch {
            while (true) {
                for (c in _state.value.cycleSpeedSeconds downTo 1) {
                    _state.value = _state.value.copy(cycleCountdown = c)
                    delay(1000)
                }
                val idx = if (isNeed) _state.value.currentNeedIndex else _state.value.currentRegionIndex
                val next = (idx + 1) % size
                _state.value = _state.value.copy(
                    currentRegionIndex = if (!isNeed) next else _state.value.currentRegionIndex,
                    currentNeedIndex = if (isNeed) next else _state.value.currentNeedIndex,
                    cycleCountdown = _state.value.cycleSpeedSeconds
                )
            }
        }
    }

    fun onReset() {
        cycleJob?.cancel()
        faceLostJob?.cancel()
        _state.value = _state.value.copy(
            currentScreen = Screen.RegionSelect,
            selectedRegion = null,
            selectedNeed = null,
            currentRegionIndex = 0,
            currentNeedIndex = 0,
            cycleCountdown = _state.value.cycleSpeedSeconds
        )
        startCycleJob(REGIONS.size, isNeed = false)
    }

    fun toggleSettings() {
        _state.value = _state.value.copy(showSettings = !_state.value.showSettings)
    }

    fun setCycleSpeed(seconds: Int) {
        _state.value = _state.value.copy(cycleSpeedSeconds = seconds)
    }

    fun setTtsVolume(vol: Float) {
        audio.volume = vol
        _state.value = _state.value.copy(ttsVolume = vol)
    }

    fun testBlink() {
        onBlinkDetected()
    }

    fun goToCalibration() {
        cycleJob?.cancel()
        faceLostJob?.cancel()
        _state.value = _state.value.copy(
            currentScreen = Screen.Calibration,
            calibrationFaceDetectedSeconds = 0f,
            calibrationComplete = false,
            faceLostCountdownSeconds = null,
            showSettings = false
        )
    }

    override fun onCleared() {
        super.onCleared()
        calibrationJob?.cancel()
        cycleJob?.cancel()
        faceLostJob?.cancel()
        if (::cameraProcessor.isInitialized) cameraProcessor.shutdown()
        audio.release()
    }
}
