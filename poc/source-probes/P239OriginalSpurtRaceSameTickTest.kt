package io.github.mee1080.umasim.race.calc2

import io.github.mee1080.umasim.race.data.RandomPosition
import io.github.mee1080.umasim.race.data.Style
import io.github.mee1080.umasim.race.data2.SkillData
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import java.io.File
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/*
 * Actual source RaceCalculator race observations. RaceFrame.spurting is
 * calculated from original natural spurtParameters and runner position.
 * Original source random-window checks are instrumented at the SAME source
 * tick. No artificial spurt injection. This single-runner model is NOT
 * a multi-runner Japanese-game activation experiment or suitability score.
 */
@OptIn(ExperimentalSerializationApi::class)
class P239OriginalSpurtRaceSameTickTest {
    @Test
    fun originalRaceSpurtAndRegisteredWhiteSkillSameTick() {
        val registryPath = System.getenv("P2_PINNED_SKILL_REGISTRY")
        val outputPath = System.getenv("P2_SPURT_RACE_SAME_TICK_TRACE_OUTPUT")
        assertTrue(!registryPath.isNullOrBlank() && !outputPath.isNullOrBlank())
        val registryFile = File(registryPath!!)
        assertTrue(registryFile.isFile && registryFile.length() > 1000000L)
        val registry = Json { allowTrailingComma = true }
            .decodeFromString<List<SkillData>>(registryFile.readText())
        val matches = registry.filter { it.id == "200512" }
        assertEquals(1, matches.size)
        val skill = matches.single()
        assertEquals(1,skill.invokes.size)
        val inv = skill.invokes.single()
        assertEquals(1,inv.index)
        assertEquals(1,inv.conditions.size)
        assertTrue(inv.preConditions.isEmpty())
        assertEquals(2,inv.conditions.single().size)
        assertEquals(setOf(
            Triple("is_lastspurt","==",1),
            Triple("phase_firsthalf_random","==",3)
        ),inv.conditions.single().map {
            Triple(it.type,it.operator,it.value)
        }.toSet())
        val styles = listOf(Style.NIGE,Style.SEN,Style.SASI,Style.OI)
        val trials = mutableListOf<String>()
        var totalFrames=0
        var spurtFrames=0
        var windowCalls=0
        var totalModelEvents=0
        var jointTicks=0
        for(style in styles)for(trial in 0 until 3) {
            P215RaceWindowHook.reset()
            P215RaceWindowHook.activeKey="phase_firsthalf_random3"
            val setting = RaceSetting(
                umaStatus=UmaStatus(style=style,gateNumber=1,wisdom=9000,
                    hasSkills=listOf(skill)),
                randomPosition=RandomPosition.RANDOM
            )
            assertTrue(setting.umaStatus.hasSkills.single() === skill)
            val (start,end)=setting.getPhaseStartEnd(3)
            val halfEnd=start+(end-start)/2
            P215RaceWindowHook.enabled=true
            val (_,state)=try {
                RaceCalculator(SystemSetting()).simulate(setting)
            } finally {
                P215RaceWindowHook.enabled=false
            }
            val frames=state.simulation.frames
            val samples=P215RaceWindowHook.samples.toList()
            assertTrue(frames.size>100)
            assertTrue(samples.size<=frames.size)
            val naturallySpurting=frames.count { it.spurting }
            val eventFrames=frames.indices.filter { index ->
                frames[index].triggeredSkills.any {
                    it.invoke.skill.id==skill.id
                }
            }.toSet()
            assertTrue(eventFrames.size<=1)
            assertTrue(samples.map { it.windowStart to it.windowEnd }.distinct().size<=1)
            var previous=-1
            var hits=0
            val witnesses=mutableListOf<String>()
            for(sample in samples) {
                assertTrue(sample.frame>previous && sample.frame in frames.indices)
                previous=sample.frame
                val frame=frames[sample.frame]
                assertTrue(abs(frame.startPosition+frame.movement-sample.position)<1e-7)
                assertTrue(sample.windowStart>=start-1e-7)
                assertTrue(sample.windowEnd<=halfEnd+1e-7)
                assertTrue(sample.windowEnd-sample.windowStart<=10.0000001)
                assertEquals(sample.position in sample.windowStart..sample.windowEnd,
                    sample.hit)
                assertTrue(frame.spurting,
                    "Spurt state must already be true when source checker reaches AND window")
                assertEquals(sample.hit,sample.frame in eventFrames,
                    "Original registered skill event must match same-tick source AND")
                if(sample.hit)hits++
                if(witnesses.size<5) {
                    witnesses += """{"frame":${sample.frame},
                        "position":${sample.position},
                        "sourceWindowStart":${sample.windowStart},
                        "sourceWindowEnd":${sample.windowEnd},
                        "windowCheckTrue":${sample.hit},
                        "actualSourceRaceFrameSpurting":${frame.spurting},
                        "originalSkillModelEvent":${sample.frame in eventFrames}}"""
                        .trimIndent().replace("\n","")
                }
            }
            assertEquals(eventFrames.size,hits,
                "All original model skill events must have a witnessed source window check")
            totalFrames+=frames.size
            spurtFrames+=naturallySpurting
            windowCalls+=samples.size
            totalModelEvents+=eventFrames.size
            jointTicks+=hits
            trials += """{"style":"${style.name}","trial":$trial,
                "sourceSkillId":"200512",
                "sourceCourseLocation":${setting.track.location},
                "sourceCourseId":${setting.track.course},
                "sourceCourseLength":${setting.courseLength},
                "sourceRaceFrameCount":${frames.size},
                "naturalRaceSpurtFrames":$naturallySpurting,
                "sameTickWindowChecks":${samples.size},
                "sameTickJointConditionHits":$hits,
                "sourceRegisteredModelEvents":${eventFrames.size},
                "originalRaceCalculatorUsed":true,
                "originalSpurtParametersNotInjected":true,
                "exampleCheckedTicks":[${witnesses.joinToString(",")}]}"""
                .trimIndent().replace("\n","")
            P215RaceWindowHook.reset()
        }
        assertEquals(12,trials.size)
        assertTrue(spurtFrames>0)
        File(outputPath!!).writeText(
            """{"schemaVersion":1,
                "status":"P2.39-original-source-RaceCalculator-natural-spurt-same-tick-checker-only",
                "originalSourceRevision":"f6e4501ee6c6c2d4ac8698e7796e309d31575bde",
                "sourceSkillId":"200512",
                "originalAND":"is_lastspurt==1 AND phase_firsthalf_random==3",
                "styles":["NIGE","SEN","SASI","OI"],
                "originalSourceRaceTrials":12,
                "originalSourceRaceFrames":$totalFrames,
                "naturalSourceSpurtFrames":$spurtFrames,
                "originalSameTickWindowChecks":$windowCalls,
                "originalSameTickJointHits":$jointTicks,
                "sourceModelRegisteredSkillEvents":$totalModelEvents,
                "actualOriginalRaceCalculatorExecuted":true,
                "originalSpurtStateArtificiallyInjected":false,
                "otherRunnersOrRaceRanksObserved":false,
                "officialGameSkillProcRate":null,
                "approvedSkillOrCardScore":null,
                "trials":[${trials.joinToString(",")}]}"""
                .trimIndent().replace("\n","") + "\n"
        )
    }
}
