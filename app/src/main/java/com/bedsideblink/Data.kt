package com.bedsideblink

data class Region(val id: String, val label: String, val needs: List<String>)

val REGIONS = listOf(
    Region("HEAD", "HEAD/FACE", listOf("Lips dry", "Face wipe", "Headache", "Glasses")),
    Region("ARMS", "ARMS/HANDS", listOf("Move arm", "Itch", "Hand position", "Joint stiff")),
    Region("TORSO", "TORSO/BACK", listOf("Turn me", "Back pain", "Chest tight", "Breathing")),
    Region("LEGS", "LEGS/FEET", listOf("Move legs", "Leg cramp", "Itch", "Toilet need"))
)
