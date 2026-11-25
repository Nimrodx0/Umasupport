package io.github.mee1080.umasim.race.calc2

import io.github.mee1080.umasim.race.data.RandomPosition
import io.github.mee1080.umasim.race.data.Style
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/* Natural single-runner source model, no equipped skill or injected state.
 * The raw frame positions support a separate counterfactual window integral.
 * They are not actual skill activation observations. */
class P255NaturalSpurtOpportunityTest {
    @Test
    fun compareNaturalSpurtAcrossFourStyles() {
        val output = System.getenv("P255_TRACE_OUTPUT")
        assertTrue(!output.isNullOrBlank())
        val trials = mutableListOf<String>()
        for ((course, length) in listOf(10501 to 1200, 10504 to 2000)) {
            for (block in 0..1) for (trial in 0 until 15) {
                for (style in listOf(Style.NIGE, Style.SEN, Style.SASI, Style.OI)) {
                    val setting = RaceSetting(
                        umaStatus = UmaStatus(style=style, gateNumber=1),
                        track = Track(location=10005, course=course),
                        randomPosition = RandomPosition.RANDOM
                    )
                    assertEquals(length, setting.courseLength)
                    assertTrue(setting.umaStatus.hasSkills.isEmpty())
                    val (result,state) = RaceCalculator(SystemSetting()).simulate(setting)
                    val (start,end) = setting.getPhaseStartEnd(3)
                    val frames = state.simulation.frames
                    assertTrue(frames.size > 100)
                    assertTrue(frames.all { it.triggeredSkills.isEmpty() })
                    // The source checker uses simulation.position after movement.
                    // RaceFrame.spurting is captured after skill processing; with
                    // no equipped skills there is no skill-induced state change.
                    val positions = frames.map { it.startPosition + it.movement }
                    val spurt = frames.mapIndexedNotNull { i,f ->
                        if (f.spurting) positions[i] else null
                    }
                    assertTrue(positions.all { it.isFinite() })
                    assertTrue(result.raceTime.isFinite())
                    trials += """{"course":$course,"distance":$length,"style":"${style.name}","block":$block,"trial":$trial,"phase3Start":$start,"phase3End":$end,"raceTime":${result.raceTime},"maxSpurt":${result.maxSpurt},"positions":[${positions.joinToString(",")}],"spurtPositions":[${spurt.joinToString(",")}]}"""
                }
            }
        }
        assertEquals(240,trials.size)
        File(output!!).writeText("""{"status":"P2.55-natural-source-single-runner-window-sensitivity","sourceRevision":"f6e4501ee6c6c2d4ac8698e7796e309d31575bde","equippedSkills":false,"fixedAbilities":true,"seedControlled":false,"trials":[${trials.joinToString(",")}]}"""+"\n")
    }
}
