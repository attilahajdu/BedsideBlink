package com.bedsideblink.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bedsideblink.AppState
import com.bedsideblink.ui.theme.BackgroundDark
import com.bedsideblink.ui.theme.HighlightOrange
import com.bedsideblink.ui.theme.TextWhite

@Composable
fun MessageScreen(
    state: AppState,
    onReset: () -> Unit,
    modifier: Modifier = Modifier
) {
    val region = state.selectedRegion
    val need = state.selectedNeed
    if (region == null || need == null) return

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(48.dp))
            Text(
                "🚨 PATIENT NEEDS HELP 🚨",
                color = HighlightOrange,
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(48.dp))
            Text(
                "REGION: ${region.label}",
                color = TextWhite,
                fontSize = 48.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                "NEED: $need",
                color = TextWhite,
                fontSize = 48.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                "🔊 Speaking aloud",
                color = TextWhite.copy(alpha = 0.7f),
                fontSize = 24.sp
            )
            Spacer(modifier = Modifier.weight(1f))
            Button(
                onClick = onReset,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(72.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color.Red),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp)
            ) {
                Text("RESET", fontSize = 28.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
