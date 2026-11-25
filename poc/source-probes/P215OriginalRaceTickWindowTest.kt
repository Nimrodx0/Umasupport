package io.github.mee1080.umasim.race.calc2

import io.github.mee1080.umasim.race.data.RandomPosition
import io.github.mee1080.umasim.race.data2.Invoke
import io.github.mee1080.umasim.race.data2.SkillCondition
import io.github.mee1080.umasim.race.data2.SkillData
import java.io.File
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/*
 * Execute PINNED source RaceCalculator with ONE synthetic phase_random skill.
 * A temporary hook observes the ORIGINAL checkInRandom closure at the same
 * source frame. This is not a real registered skill or a JP game proc rate.
 */
class P215OriginalRaceTickWindowTest {
    private val id = "99000216"
    @Test
    fun actualRaceCalculatorSkillCheckFramesShareOriginalDrawnPhaseWindow() {
        val output = System.getenv("P2_PHASE_RACE_TRACE_OUTPUT")
        assertTrue(!output.isNullOrBlank(), "CI trace destination required")
        val skill = SkillData(
            id = id,
            name = "P2.15 synthetic race-tick phase random observer",
            rarity = "normal",
            group = 0,
            type = "speed",
            activateLot = 0,
            invokes = listOf(
                Invoke(
                    skillId = id, index = 1,
                    conditions = listOf(listOf(SkillCondition("phase_random", "==", 2)))
                )
            )
        )
        val records = mutableListOf<String>()
        repeat(3) { trial ->
            P215RaceWindowHook.reset()
            val setting = RaceSetting(
                umaStatus = UmaStatus(gateNumber = 1, hasSkills = listOf(skill)),
                randomPosition = RandomPosition.RANDOM
            )
            val bounds = setting.getPhaseStartEnd(2)
            P215RaceWindowHook.enabled = true
            val (_, state) = try {
                RaceCalculator(SystemSetting()).simulate(setting)
            } finally {
                P215RaceWindowHook.enabled = false
            }
            val samples = P215RaceWindowHook.samples.toList()
            assertTrue(samples.isNotEmpty(), "Original phase_random2 not checked in race")
            assertTrue(samples.size < 5001, "Runaway source tick recording")
            val first = samples.first()
            assertTrue(first.windowStart >= bounds.first)
            assertTrue(first.windowStart <= bounds.second - 2.0 + 1e-7)
            assertTrue(first.windowEnd <= bounds.second + 1e-7)
            assertTrue(first.windowEnd >= first.windowStart)
            assertTrue(first.windowEnd - first.windowStart <= 10.0 + 1e-7)
            assertTrue(samples.any { it.hit }, "Source race had no sampled window hit")
            assertTrue(samples.any { !it.hit }, "Source race had no sampled non-hit")
            val frames = state.simulation.frames
            var previousTick = -1
            val lines = samples.map { row ->
                assertTrue(row.frame > previousTick && row.frame > 0)
                previousTick = row.frame
                assertTrue(row.frame < frames.size, "Unrecorded source race frame")
                val frame = frames[row.frame]
                // updateFrame moves, checks skill, then appends the SAME frame.
                val framePosition = frame.startPosition + frame.movement
                assertTrue(abs(framePosition - row.position) < 1e-7,
                    "Original skill-check position not the recorded frame position")
                assertEquals(first.windowStart, row.windowStart,
                    "Original condition's random window moved during race")
                assertEquals(first.windowEnd, row.windowEnd,
                    "Original condition's random window moved during race")
                assertEquals(row.position >= row.windowStart && row.position <= row.windowEnd,
                    row.hit, "Source checkInRandom disagreed with interval geometry")
                assertEquals(row.hit, frame.triggeredSkills.any { it.invoke.skill.id == id },
                    "Source frame skill event did not match its original random window check")
                """{"tick":${row.frame},"position":${row.position},
                "start":${row.windowStart},"end":${row.windowEnd},
                "hit":${row.hit}}""".trimIndent().replace("\n", "")
            }
            val hits = samples.count { it.hit }
            val misses = samples.size - hits
            assertTrue(frames.isNotEmpty())
            records.add(
                """{"trial":$trial,"syntheticSourceSkillId":"$id",
                "randomPositionMode":"RANDOM","phaseId":2,
                "raceCalculatorExecuted":true,
                "phaseStart":${bounds.first},"phaseEnd":${bounds.second},
                "windowStart":${first.windowStart},"windowEnd":${first.windowEnd},
                "raceFrameCount":${frames.size},
                "sourceCheckerCalls":${samples.size},
                "sourceCheckerTrueCount":$hits,"sourceCheckerFalseCount":$misses,
                "sameOriginalWindowEveryTick":true,"framePositionJoined":true,
                "realRegisteredSkillEquipped":false,
                "sourceOrderRateEvaluated":false,"gameProcRateComputed":false,
                "ticks":[${lines.joinToString(",")}]}""".trimIndent().replace("\n", "")
            )
            P215RaceWindowHook.reset()
        }
        File(output!!).writeText(
            """{"schemaVersion":1,
            "status":"p2-15-pinned-source-race-calculator-phase-random-same-skill-tick",
            "sourceModel":"pinned-mee1080-umasim","syntheticSourceSkillId":"$id",
            "trialCount":${records.size},
            "instrumentation":"one-original-checkInRandom-return-with-identity-boolean",
            "actualUmaSimRaceCalculatorExecuted":true,
            "sourceRankImplemented":false,"realSourceSkillRecordsUsed":false,
            "gameProcOrSuitabilityCalculated":false,
            "races":[${records.joinToString(",")}]}""".trimIndent().replace("\n", "")+"\n"
        )
    }
}
