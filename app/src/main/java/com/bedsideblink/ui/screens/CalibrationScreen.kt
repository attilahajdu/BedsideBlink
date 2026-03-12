package com.bedsideblink.ui.screens

import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.bedsideblink.AppState
import com.bedsideblink.ui.theme.BackgroundDark
import com.bedsideblink.ui.theme.HighlightOrange
import com.bedsideblink.ui.theme.TextWhite

@Composable
fun CalibrationScreen(
    state: AppState,
    previewView: PreviewView?,
    onStart: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier.fillMaxSize().background(BackgroundDark)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // 70% camera preview with face outline
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(0.7f)
                    .padding(8.dp)
            ) {
                if (previewView != null) {
                    AndroidView(
                        factory = { previewView },
                        modifier = Modifier.fillMaxSize()
                    )
                }
                if (state.faceDetected) {
                    FaceOutlineOverlay()
                }
            }

            Text(
                "Position phone 40–60cm from face",
                color = TextWhite,
                fontSize = 24.sp,
                modifier = Modifier.padding(vertical = 16.dp)
            )

            Text(
                if (state.faceDetected) "Face detected: ${state.calibrationFaceDetectedSeconds.toInt()}s / 10s" else "Waiting for face...",
                color = if (state.faceDetected) HighlightOrange else TextWhite.copy(alpha = 0.7f),
                fontSize = 20.sp,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            Button(
                onClick = onStart,
                enabled = state.calibrationComplete,
                colors = ButtonDefaults.buttonColors(containerColor = HighlightOrange),
                modifier = Modifier
                    .fillMaxWidth(0.8f)
                    .height(56.dp)
            ) {
                Text("START", fontSize = 24.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun FaceOutlineOverlay() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .border(4.dp, Color.Green, RoundedCornerShape(8.dp))
    )
}
