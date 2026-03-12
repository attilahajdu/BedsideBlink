package com.bedsideblink

import android.content.Context
import android.graphics.Rect
import android.util.Log
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceDetector
import java.util.concurrent.Executors

/**
 * CameraX ImageAnalysis that runs ML Kit face detection and feeds
 * eyes-open probability to BlinkDetector, then invokes callback.
 */
class CameraProcessor(
    private val context: Context,
    private val blinkDetector: BlinkDetector,
    private val onBlinkDetected: () -> Unit,
    private val onFaceDetected: (Rect?) -> Unit,
    private val onEyesOpenProb: (Float?) -> Unit
) {
    private val executor = Executors.newSingleThreadExecutor()

    private val options = FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .setContourMode(FaceDetectorOptions.CONTOUR_MODE_OFF)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
        .setMinFaceSize(0.15f)
        .build()

    private val detector: FaceDetector = FaceDetection.getClient(options)

    val analyzer = ImageAnalysis.Analyzer { imageProxy ->
        processImage(imageProxy)
    }

    private fun processImage(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image ?: run {
            imageProxy.close()
            return@Analyzer
        }
        val rotation = imageProxy.imageInfo.rotationDegrees
        val inputImage = InputImage.fromMediaImage(mediaImage, rotation)

        detector.process(inputImage)
            .addOnSuccessListener(executor) { faces ->
                val face = faces.firstOrNull()
                onFaceDetected(face?.boundingBox)
                val prob = face?.let { f ->
                    val left = f.leftEyeOpenProbability
                    val right = f.rightEyeOpenProbability
                    when {
                        left != null && right != null -> minOf(left, right)
                        left != null -> left
                        right != null -> right
                        else -> null
                    }
                }
                onEyesOpenProb(prob)
                prob?.let { p ->
                    when (val state = blinkDetector.processEyesOpenProb(p)) {
                        is BlinkState.BlinkDetected -> {
                            Log.d("BedsideBlink", "BLINK!")
                            onBlinkDetected()
                        }
                        else -> { /* ignore */ }
                    }
                }
            }
            .addOnFailureListener(executor) { e ->
                Log.e("BedsideBlink", "Face detection failed", e)
                onFaceDetected(null)
                onEyesOpenProb(null)
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    }

    fun shutdown() {
        detector.close()
        executor.shutdown()
    }
}
