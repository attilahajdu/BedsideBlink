package com.bedsideblink

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.bedsideblink.ui.FaceLostOverlay
import com.bedsideblink.ui.SettingsOverlay
import com.bedsideblink.ui.screens.CalibrationScreen
import com.bedsideblink.ui.screens.MessageScreen
import com.bedsideblink.ui.screens.NeedScreen
import com.bedsideblink.ui.screens.RegionScreen
import androidx.lifecycle.ViewModelProvider
import com.bedsideblink.ui.theme.BackgroundDark

class MainActivity : ComponentActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var viewModel: MainViewModel

    private val requestPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants[Manifest.permission.CAMERA] == true) {
            startCamera()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        previewView = PreviewView(this).apply {
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        }

        viewModel = ViewModelProvider(this)[MainViewModel::class.java]
        viewModel.initCameraProcessor(this)

        setContent {
            val state by viewModel.state.collectAsState()

            Box(modifier = Modifier.fillMaxSize()) {
                when (state.currentScreen) {
                    Screen.Calibration -> CalibrationScreen(
                        state = state,
                        previewView = previewView,
                        onStart = { viewModel.onStartPressed() }
                    )
                    Screen.RegionSelect -> RegionScreen(
                        state = state,
                        previewView = previewView
                    )
                    Screen.NeedSelect -> NeedScreen(
                        state = state,
                        previewView = previewView
                    )
                    Screen.Message -> MessageScreen(
                        state = state,
                        onReset = { viewModel.onReset() }
                    )
                }

                if (state.faceLostCountdownSeconds != null) {
                    FaceLostOverlay(countdownSeconds = state.faceLostCountdownSeconds!!)
                }

                if (state.showSettings) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.5f))
                    ) {
                        SettingsOverlay(
                            state = state,
                            onCycleSpeed = { viewModel.setCycleSpeed(it) },
                            onTtsVolume = { viewModel.setTtsVolume(it) },
                            onTestBlink = { viewModel.testBlink() },
                            onCalibration = { viewModel.goToCalibration() },
                            onDismiss = { viewModel.toggleSettings() }
                        )
                    }
                } else {
                    FloatingActionButton(
                        onClick = { viewModel.toggleSettings() },
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(16.dp),
                        containerColor = com.bedsideblink.ui.theme.HighlightOrange
                    ) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Settings"
                        )
                    }
                }
            }
        }

        checkPermissionsAndStartCamera()
    }

    private fun checkPermissionsAndStartCamera() {
        val perms = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            perms.add(Manifest.permission.CAMERA)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (perms.isEmpty()) {
            startCamera()
        } else {
            requestPermission.launch(perms.toTypedArray())
        }
    }

    private fun startCamera() {
        val provider = ProcessCameraProvider.getInstance(this)
        provider.addListener({
            val cameraProvider = provider.get()
            val preview = Preview.Builder().build().apply {
                setSurfaceProvider(previewView.surfaceProvider)
            }
            val analysisUseCase = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .apply {
                    setAnalyzer(
                        java.util.concurrent.Executors.newSingleThreadExecutor(),
                        viewModel.cameraProcessor.analyzer
                    )
                }
            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_FRONT_CAMERA,
                    preview,
                    analysisUseCase
                )
            } catch (e: Exception) {
                Log.e("BedsideBlink", "Camera bind failed", e)
            }
        }, ContextCompat.getMainExecutor(this))
    }
}
