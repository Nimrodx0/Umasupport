package io.github.mee1080.umasim.race.calc2

import io.github.mee1080.umasim.race.data.RandomPosition
import io.github.mee1080.umasim.race.data2.Invoke
import io.github.mee1080.umasim.race.data2.SkillCondition
import io.github.mee1080.umasim.race.data2.SkillData
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

/*
 * Copied temporarily into pinned mee1080/umasim's jvmTest sourceSet in CI.
 * Executes actual source SkillChecker, not a JS window approximation.
 * This does NOT invoke RaceCalculator, model ranking or the actual JP game.
 *
 * Source SkillChecker ignores order_rate. We intentionally include it in a
 * synthetic skill to avoid confusing window observation with full source AND.
 */
class P215SourcePhaseWindowRuntimeTest {
    private val sourceSkillId = "99000215"
    private val phaseNumber = 2
    private val condition = SkillCondition("phase_random", "==", phaseNumber)
    private val rank = SkillCondition("order_rate", ">", 50)

    @Test
    fun originalRandomWindowWasDrawnCachedAndCheckedAtControlledPositions() {
        val output = System.getenv("P2_PHASE_SOURCE_TRACE_OUTPUT")
        assertTrue(!output.isNullOrEmpty(), "Explicit CI trace output required")
        val skill = SkillData(
            id = sourceSkillId,
            name = "P2.15 controlled source checker experiment",
            rarity = "normal",
            group = 0,
            type = "speed",
            invokes = listOf(
                Invoke(
                    skillId = sourceSkillId,
                    index = 1,
                    conditions = listOf(listOf(rank, condition))
                )
            )
        )
        val setting = RaceSetting(randomPosition = RandomPosition.RANDOM)
        val (phaseStart, phaseEnd) = setting.getPhaseStartEnd(phaseNumber)
        val key = "phase_random$phaseNumber"
        val trials = mutableListOf<String>()
        // Each new CalculatedConditions corresponds to a fresh skill setup.
        // Random.nextDouble() runs INSIDE original chooseRandom().
        for (trial in 0 until 12) {
            val calculated = CalculatedConditions()
            val predicate = checkCondition(
                skill, skill.invokes.single().conditions, setting, calculated
            )
            val cached = assertNotNull(calculated.calculatedAreas[key])
            val area = cached.single()
            val start = area.start
            val end = area.endInclusive
            assertTrue(start.isFinite() && end.isFinite())
            assertTrue(start >= phaseStart && start <= phaseEnd - 2.0 + 1e-8)
            assertTrue(end >= start && end <= phaseEnd + 1e-8)
            assertTrue(end - start <= 10.0 + 1e-8)

            // Same cache key must reuse actual original RandomEntry object.
            val secondPredicate = checkCondition(
                skill, skill.invokes.single().conditions, setting, calculated
            )
            assertSame(cached, calculated.calculatedAreas[key])
            assertSame(area, calculated.calculatedAreas[key]!!.single())
            assertEquals(1, calculated.calculatedAreas.size)

            // Controlled positions/ticks are NOT from a simulated race.
            val simulated = RaceSimulationState()
            val race = RaceState(
                RaceSettingWithPassive(setting, PassiveBonus()),
                simulated, SystemSetting(), null
            )
            fun evaluate(tick: Int, position: Double, block: RaceState.() -> Boolean): Boolean {
                simulated.frameElapsed = tick
                simulated.position = position
                simulated.startPosition = position
                return block(race)
            }
            val outsideStart = evaluate(0, start - 0.01, predicate)
            val insideStart = evaluate(1, start, predicate)
            val insideEnd = evaluate(2, end, secondPredicate)
            val outsideEnd = evaluate(3, end + 0.01, predicate)
            assertEquals(false, outsideStart)
            assertEquals(true, insideStart)
            assertEquals(true, insideEnd)
            assertEquals(false, outsideEnd)

            trials.add(
                """{"trial":$trial,"sourceSkillId":"$sourceSkillId",
                "cacheKey":"$key","phaseId":$phaseNumber,
                "phaseStart":$phaseStart,"phaseEnd":$phaseEnd,
                "drawnWindowStart":$start,"drawnWindowEndInclusive":$end,
                "outsideStart":$outsideStart,"insideStart":$insideStart,
                "insideEnd":$insideEnd,"outsideEnd":$outsideEnd,
                "cacheReusedForSameSkill":true,
                "controlledPositionTickIndices":[0,1,2,3],
                "actualOriginalWindowObserved":true,
                "raceSimulationUsed":false,
                "modelOrGameRankObserved":false}""".trimIndent().replace("\n", "")
            )
        }
        File(output!!).writeText(
            """{"schemaVersion":1,
            "status":"p2-15-pinned-umasim-source-checker-actual-random-window-controlled-position-only",
            "sourceSkillId":"$sourceSkillId","phaseId":$phaseNumber,
            "randomPositionMode":"RANDOM",
            "trialCount":${trials.size},
            "sourceCompiledAndExecuted":true,
            "originalRaceCalculatorInvoked":false,
            "sourceOrderRateRuntimeChecked":false,
            "actualGameSkillProcObserved":false,
            "trials":[${trials.joinToString(",")}]}""".trimIndent().replace("\n", "") + "\n"
        )
    }
}
