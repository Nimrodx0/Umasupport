package io.github.mee1080.umasim.race.calc2

import io.github.mee1080.umasim.race.data.RandomPosition
import io.github.mee1080.umasim.race.data2.SkillData
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/*
 * Original registered SkillData is preserved. Original unmodified SkillChecker
 * is evaluated on deliberately controlled spurtParameters and runner positions.
 * No original RaceCalculator ticks and no actual race spurt incidence observed.
 */
@OptIn(ExperimentalSerializationApi::class)
class P238OriginalRegisteredSpurtPhaseAndTest {
    @Test
    fun originalRegisteredSpurtAndFirstHalfWindowCheckerTruthTable() {
        val registryPath = System.getenv("P2_PINNED_SPURT_SOURCE_REGISTRY")
        val outputPath = System.getenv("P2_PINNED_SPURT_AND_TRACE_OUTPUT")
        assertTrue(!registryPath.isNullOrBlank(), "Pinned source registry required")
        assertTrue(!outputPath.isNullOrBlank(), "Explicit trace output required")
        val file = File(registryPath!!)
        assertTrue(file.isFile && file.length() > 1_000_000L)
        val source = Json { allowTrailingComma = true }
            .decodeFromString<List<SkillData>>(file.readText())
        val ids = listOf("200511", "200512")
        val cohort = ids.map { id ->
            val same = source.filter { it.id == id }
            assertEquals(1, same.size, "Original source skill ID: $id")
            val skill = same.single()
            assertEquals(1, skill.invokes.size, "One original Invoke: $id")
            val inv = skill.invokes.single()
            assertEquals(1, inv.index, "Original Invoke index: $id")
            assertEquals(1, inv.conditions.size, "One original OR: $id")
            assertEquals(0, inv.preConditions.size, "No precondition OR: $id")
            val and = inv.conditions.single()
            assertEquals(2, and.size, "Two original AND predicates: $id")
            val spurt = and.single { it.type == "is_lastspurt" }
            val window = and.single { it.type == "phase_firsthalf_random" }
            assertEquals("==", spurt.operator)
            assertEquals(1, spurt.value)
            assertEquals("==", window.operator)
            assertTrue(window.value in 0..3)
            Triple(skill, window.value, and.map { Triple(it.type, it.operator, it.value) })
        }
        assertEquals(cohort[0].third.sortedBy { it.first },
            cohort[1].third.sortedBy { it.first },
            "The registered gold/white source AND must be identical")

        val setting = RaceSetting(randomPosition = RandomPosition.RANDOM)
        val phaseNumber = cohort.first().second
        val (phaseStart, phaseEnd) = setting.getPhaseStartEnd(phaseNumber)
        val halfEnd = phaseStart + (phaseEnd - phaseStart) * 0.5
        assertTrue(halfEnd - phaseStart > 10.0)
        val trace = mutableListOf<String>()
        for ((skill, phase, _) in cohort) {
            val inv = skill.invokes.single()
            for (trial in 0 until 6) {
                val calculated = CalculatedConditions()
                val checker = checkCondition(skill, inv.conditions, setting, calculated)
                val key = "phase_firsthalf_random$phase"
                val cached = assertNotNull(calculated.calculatedAreas[key])
                val area = cached.single()
                val start = area.start
                val end = area.endInclusive
                assertTrue(start >= phaseStart - 1e-7 && start <= halfEnd - 2.0 + 1e-7)
                assertTrue(end >= start && end <= halfEnd + 1e-7)
                assertTrue(end - start <= 10.0 + 1e-7)
                val simulation = RaceSimulationState()
                val state = RaceState(
                    RaceSettingWithPassive(setting, PassiveBonus()),
                    simulation, SystemSetting(), null
                )
                var tick = 0
                fun eval(pos: Double, spurtDistance: Double?): Boolean {
                    simulation.frameElapsed = tick++
                    simulation.position = pos
                    simulation.startPosition = pos
                    simulation.spurtParameters = spurtDistance?.let {
                        SpurtParameters(distance = it, speed = 25.0, spDiff = 0.0)
                    }
                    return checker(state)
                }
                val at = (start + end) * 0.5
                val enough = setting.courseLength - at + 1.0
                val insufficient = setting.courseLength - at - 1.0
                val noSpurt = eval(at, null)
                val tooShortSpurt = eval(at, insufficient)
                val both = eval(at, enough)
                val beforeWithSpurt = eval(start - 0.01,
                    setting.courseLength - (start - 0.01) + 1.0)
                val afterWithSpurt = eval(end + 0.01,
                    setting.courseLength - (end + 0.01) + 1.0)
                assertEquals(false, noSpurt)
                assertEquals(false, tooShortSpurt)
                assertEquals(true, both)
                assertEquals(false, beforeWithSpurt)
                assertEquals(false, afterWithSpurt)
                checkCondition(skill, inv.conditions, setting, calculated)
                assertTrue(calculated.calculatedAreas[key] === cached)
                assertEquals(1, calculated.calculatedAreas.size)
                val skillId = skill.id
                trace += """{"skillId":"$skillId","trial":$trial,"sourcePhase":$phase,
                    "windowStart":$start,"windowEnd":$end,
                    "spurtNullWindowIn":$noSpurt,
                    "spurtInsufficientWindowIn":$tooShortSpurt,
                    "spurtSufficientWindowIn":$both,
                    "spurtTrueWindowBefore":$beforeWithSpurt,
                    "spurtTrueWindowAfter":$afterWithSpurt,
                    "originalSourceCheckerCalls":5,
                    "spurtParametersArtificial":true,
                    "raceCalculatorInvoked":false,
                    "realGameProcMeasured":false}""".trimIndent().replace("\n", "")
            }
        }
        File(outputPath!!).writeText(
            """{"schemaVersion":1,
                "status":"P2.38-original-registered-spurt-halfphase-AND-controlled-checker-only",
                "sourceSkillIds":["200511","200512"],
                "originalSourcePhase":$phaseNumber,
                "originalSkillCount":2,
                "originalANDConditionCountPerSkill":2,
                "originalSourceCheckerTruthTableTrials":12,
                "originalSourceCheckerCalls":60,
                "originalRaceCalculatorUsed":false,
                "originalSpurtParametersObservedFromRace":false,
                "actualGameSpurtOrSkillRate":null,
                "approvedSkillOrCardSuitabilityScore":null,
                "trials":[${trace.joinToString(",")}]}""".trimIndent().replace("\n", "") + "\n"
        )
    }
}
