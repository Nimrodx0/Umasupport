package io.github.mee1080.umasim.race.calc2

/*
 * P2.15 test-only hook: installed into a TEMPORARY pinned upstream checkout.
 * It records the exact original source checker invocation at the actual
 * RaceCalculator/checkSkillTrigger frame. It does not call RNG or change the
 * predicate boolean. Never install into the published application.
 */
internal object P215RaceWindowHook {
    data class Tick(
        val frame: Int,
        val position: Double,
        val windowStart: Double,
        val windowEnd: Double,
        val hit: Boolean,
    )
    var enabled: Boolean = false
    var activeKey: String = "phase_random2"
    val samples = mutableListOf<Tick>()
    fun reset() {
        enabled = false
        activeKey = "phase_random2"
        samples.clear()
    }
    fun record(
        key: String,
        frame: Int,
        position: Double,
        areas: List<RandomEntry>,
        hit: Boolean,
    ) {
        if (!enabled || key != activeKey) return
        check(areas.size == 1) { "P2.15/P2.39 expects one original random interval" }
        val window = areas.single()
        samples.add(
            Tick(
                frame = frame,
                position = position,
                windowStart = window.start,
                windowEnd = window.endInclusive,
                hit = hit,
            )
        )
    }
}
