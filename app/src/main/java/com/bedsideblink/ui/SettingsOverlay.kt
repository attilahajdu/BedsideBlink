package com.bedsideblink.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bedsideblink.AppState
import com.bedsideblink.ui.theme.BackgroundDark
import com.bedsideblink.ui.theme.HighlightOrange
import com.bedsideblink.ui.theme.TextWhite

@Composable
fun SettingsOverlay(
    state: AppState,
    onCycleSpeed: (Int) -> Unit,
    onTtsVolume: (Float) -> Unit,
    onTestBlink: () -> Unit,
    onCalibration: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(BackgroundDark.copy(alpha = 0.98f))
            .padding(24.dp)
    ) {
        Text("Settings", color = TextWhite, fontSize = 24.sp)
        Spacer(modifier = Modifier.height(16.dp))

        Text("Cycle speed:", color = TextWhite, fontSize = 18.sp)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf(3, 4, 5, 6).forEach { sec ->
                val selected = state.cycleSpeedSeconds == sec
                Text(
                    if (selected) "${sec}s ✓" else "${sec}s",
                    color = if (selected) HighlightOrange else TextWhite.copy(alpha = 0.6f),
                    fontSize = 18.sp,
                    modifier = Modifier
                        .padding(8.dp)
                        .clickable { onCycleSpeed(sec) }
                )
            }
        }
        Spacer(modifier = Modifier.height(16.dp))

        Text("TTS volume:", color = TextWhite, fontSize = 18.sp)
        Slider(
            value = state.ttsVolume,
            onValueChange = onTtsVolume,
            valueRange = 0f..1f,
            colors = SliderDefaults.colors(
                thumbColor = HighlightOrange,
                activeTrackColor = HighlightOrange
            )
        )
        Spacer(modifier = Modifier.height(16.dp))

        Text(
            "Test blink",
            color = TextWhite,
            fontSize = 18.sp,
            modifier = Modifier
                .clickable { onTestBlink() }
                .padding(8.dp)
        )
        Spacer(modifier = Modifier.height(8.dp))

        Text(
            "Back to calibration",
            color = HighlightOrange,
            fontSize = 18.sp,
            modifier = Modifier
                .clickable {
                    onCalibration()
                }
                .padding(8.dp)
        )
        Spacer(modifier = Modifier.height(8.dp))

        Text(
            "Close",
            color = TextWhite.copy(alpha = 0.7f),
            fontSize = 16.sp,
            modifier = Modifier
                .clickable { onDismiss() }
                .padding(8.dp)
        )
    }
}
