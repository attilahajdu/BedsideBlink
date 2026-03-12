package com.bedsideblink.ui.screens

import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.bedsideblink.AppState
import com.bedsideblink.ui.theme.BackgroundDark
import com.bedsideblink.ui.theme.HighlightOrange
import com.bedsideblink.ui.theme.TextWhite

@Composable
fun NeedScreen(
    state: AppState,
    previewView: PreviewView?,
    modifier: Modifier = Modifier
) {
    val region = state.selectedRegion ?: return
    val needs = region.needs

    Box(modifier = modifier.fillMaxSize().background(BackgroundDark)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
            Box(modifier = Modifier.width(120.dp).height(90.dp)) {
                if (previewView != null) {
                    AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())
                }
            }
            Spacer(modifier = Modifier.height(8.dp))

            val need = needs[state.currentNeedIndex]
            Text(
                "Current: $need",
                color = HighlightOrange,
                fontSize = 28.sp
            )
            Text(
                "Next: ${state.cycleCountdown}...",
                color = TextWhite.copy(alpha = 0.9f),
                fontSize = 20.sp,
                modifier = Modifier.padding(top = 4.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                "BLINK to select",
                color = TextWhite.copy(alpha = 0.7f),
                fontSize = 18.sp,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                listOf(0 to 1, 2 to 3).forEach { (a, b) ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        listOf(a, b).forEach { i ->
                            val n = needs[i]
                            val highlighted = i == state.currentNeedIndex
                            Card(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(100.dp)
                                    .then(if (highlighted) Modifier.border(3.dp, HighlightOrange) else Modifier),
                                colors = CardDefaults.cardColors(
                                    containerColor = if (highlighted) HighlightOrange.copy(alpha = 0.4f) else TextWhite.copy(alpha = 0.1f)
                                )
                            ) {
                                Text(
                                    n,
                                    color = TextWhite,
                                    fontSize = 20.sp,
                                    modifier = Modifier.padding(16.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
