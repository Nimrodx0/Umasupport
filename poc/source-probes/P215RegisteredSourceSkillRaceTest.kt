package io.github.mee1080.umasim.race.calc2

import io.github.mee1080.umasim.race.data.RandomPosition
import io.github.mee1080.umasim.race.data2.SkillData
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import java.io.File
import java.security.MessageDigest
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertSame
import kotlin.test.assertTrue

/*
 * Test-only probe inside a pinned, temporary upstream checkout.
 * The skill is read from THAT checkout's original skill_data.txt verbatim.
 * No SkillData/Invoke/SkillCondition mutations, no fake rank predicate.
 */
@OptIn(ExperimentalSerializationApi::class)
class P215RegisteredSourceSkillRaceTest {
    private data class Choice(
        val skill: SkillData,
        val invokeIndex: Int,
        val orIndex: Int,
        val predicateTypes: List<String>,
        val extra: Int,
        val preconditionGroups: Int,
    )

    private fun logicHash(skill: SkillData): String {
        // Identical to JSON.stringify([invokeIndex, [[type,operator,value]], pre...])
        // on the fixed application source profile. No original condition
        // text or original literal thresholds are published in the output.
        val canonical = buildJsonArray {
            skill.invokes.forEach { invoke ->
                add(buildJsonArray {
                    add(JsonPrimitive(invoke.index))
                    add(buildJsonArray {
                        invoke.conditions.forEach { and ->
                            add(buildJsonArray {
                                and.forEach { predicate ->
                                    add(buildJsonArray {
                                        add(JsonPrimitive(predicate.type))
                                        add(JsonPrimitive(predicate.operator))
                                        add(JsonPrimitive(predicate.value))
                                    })
                                }
                            })
                        }
                    })
                    add(buildJsonArray {
                        invoke.preConditions.forEach { and ->
                            add(buildJsonArray {
                                and.forEach { predicate ->
                                    add(buildJsonArray {
                                        add(JsonPrimitive(predicate.type))
                                        add(JsonPrimitive(predicate.operator))
                                        add(JsonPrimitive(predicate.value))
                                    })
                                }
                            })
                        }
                    })
                })
            }
        }.toString()
        return MessageDigest.getInstance("SHA-256")
            .digest(canonical.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }

    private fun loadChoices(): List<Choice> {
        val path = System.getenv("P2_PINNED_SKILL_REGISTRY")
        assertTrue(!path.isNullOrBlank(), "Pinned registry path must be explicit")
        val source = File(path)
        assertTrue(source.isFile && source.length() > 1_000_000L,
            "Registry must come from full pinned original source")
        val registry = Json { allowTrailingComma = true }
            .decodeFromString<List<SkillData>>(source.readText())
        assertTrue(registry.size >= 800, "Source registry unexpectedly small")
        val cohortPath = System.getenv("P2_SOURCE_85_IDS_PATH")
        assertTrue(!cohortPath.isNullOrBlank(), "Original source 85 ID cohort required")
        val allowed = Json.decodeFromString<List<String>>(File(cohortPath).readText()).toSet()
        assertEquals(85, allowed.size, "Expected 85 original app source routes")
        return registry.flatMap { skill ->
            if (skill.id !in allowed) return@flatMap emptyList<Choice>()
            if (skill.rarity == "unique") return@flatMap emptyList<Choice>()
            skill.invokes.flatMap { invoke ->
                invoke.conditions.mapIndexedNotNull { i, and ->
                    val types = and.map { it.type }
                    if (!and.any { it.type == "phase_random" && it.value == 2 } ||
                        !types.contains("order_rate")) return@mapIndexedNotNull null
                    val otherRandom = skill.invokes.sumOf { item ->
                        item.conditions.sumOf { branch ->
                            branch.count { it.type == "phase_random" && it.value == 2 }
                        }
                    }
                    if (otherRandom != 1) return@mapIndexedNotNull null
                    Choice(
                        skill = skill,
                        invokeIndex = invoke.index,
                        orIndex = i,
                        predicateTypes = types,
                        extra = types.count { it != "phase_random" && it != "order_rate" },
                        preconditionGroups = invoke.preConditions.size,
                    )
                }
            }
        }.sortedWith(
            compareBy<Choice>(
                { it.extra },
                { it.preconditionGroups },
                { it.skill.invokes.size },
                { it.skill.id },
            )
        )
    }

    @Test
    fun pinnedRegisteredSourceSkillRetainsOriginalConditionsAndTrace() {
        val output = System.getenv("P2_REGISTERED_SOURCE_RACE_TRACE_OUTPUT")
        assertTrue(!output.isNullOrBlank(), "Explicit CI trace destination required")
        val choices = loadChoices()
        assertTrue(choices.isNotEmpty(), "No original order_rate+phase_random2 source AND")
        println("P2_15_REGISTERED_SOURCE_CANDIDATES=" + choices.size)

        val audits = mutableListOf<String>()
        var successful = false
        for (choice in choices.take(12)) {
            val originalSkill = choice.skill
            val originalInvoke = originalSkill.invokes.singleOrNull { it.index == choice.invokeIndex }
                ?: error("Original selected Invoke index is not unique")
            assertTrue(originalInvoke.conditions[choice.orIndex].any {
                it.type == "phase_random" && it.value == 2
            })
            assertTrue(originalInvoke.conditions[choice.orIndex].any {
                it.type == "order_rate"
            })
            val allowed = Json.decodeFromString<List<String>>(
                File(System.getenv("P2_SOURCE_85_IDS_PATH")).readText()).toSet()
            assertTrue(originalSkill.id in allowed, "Selected source skill must belong to pinned app 85 cohort")
            val sourceLogicSha256 = logicHash(originalSkill)
            assertTrue(sourceLogicSha256.matches(Regex("[a-f0-9]{64}")))
            val sourceInvokeCount = originalSkill.invokes.size
            val sourceORCount = originalInvoke.conditions.size
            val sourceANDSize = originalInvoke.conditions[choice.orIndex].size
            val sourcePreORCount = originalInvoke.preConditions.size
            val trialRows = mutableListOf<String>()
            var joined = 0
            var hits = 0
            var misses = 0
            var modelEvents = 0
            for (trial in 0 until 3) {
                P215RaceWindowHook.reset()
                val setting = RaceSetting(
                    umaStatus = UmaStatus(
                        gateNumber = 1,
                        wisdom = 9000,
                        hasSkills = listOf(originalSkill),
                    ),
                    randomPosition = RandomPosition.RANDOM,
                )
                assertSame(originalSkill, setting.umaStatus.hasSkills.single(),
                    "Must equip original unmodified registry SkillData")
                val bounds = setting.getPhaseStartEnd(2)
                P215RaceWindowHook.enabled = true
                val (_, state) = try {
                    RaceCalculator(SystemSetting()).simulate(setting)
                } finally {
                    P215RaceWindowHook.enabled = false
                }
                val samples = P215RaceWindowHook.samples.toList()
                val frames = state.simulation.frames
                var previous = 0
                var trueCalls = 0
                var falseCalls = 0
                val ticks = samples.map { row ->
                    assertTrue(row.frame > previous && row.frame < frames.size,
                        "Original source checker frame must match completed RaceCalculator frames")
                    previous = row.frame
                    val originalFrame = frames[row.frame]
                    assertTrue(abs(originalFrame.startPosition +
                        originalFrame.movement - row.position) < 1e-7,
                        "Source frame position does not match original checked position")
                    assertTrue(row.windowStart >= bounds.first &&
                        row.windowEnd <= bounds.second + 1e-7)
                    assertEquals(
                        row.position >= row.windowStart && row.position <= row.windowEnd,
                        row.hit, "Original source checker phase membership disagrees"
                    )
                    if (row.hit) trueCalls++ else falseCalls++
                    """{"tick":${row.frame},"position":${row.position},
                    "start":${row.windowStart},"end":${row.windowEnd},
                    "phasePredicateHit":${row.hit}}""".trimIndent().replace("\n", "")
                }
                if (samples.isNotEmpty()) {
                    assertTrue(samples.all { it.windowStart == samples.first().windowStart &&
                        it.windowEnd == samples.first().windowEnd },
                        "Original per-skill phase random cache changed during source race")
                }
                val events = frames.sumOf { frame ->
                    frame.triggeredSkills.count { it.invoke.skill.id == originalSkill.id }
                }
                joined += samples.size
                hits += trueCalls
                misses += falseCalls
                modelEvents += events
                trialRows +=
                    """{"trial":$trial,"raceFrameCount":${frames.size},
                    "originalCheckerCalls":${samples.size},
                    "phasePredicateTrueCalls":$trueCalls,
                    "phasePredicateFalseCalls":$falseCalls,
                    "modelSkillEvents":$events,
                    "originalPhaseRandomWindowWasChecked":${samples.isNotEmpty()},
                    "ticks":[${ticks.joinToString(",")}]}""".trimIndent().replace("\n", "")
                P215RaceWindowHook.reset()
            }
            if (joined == 0) {
                println("P2_15_REGISTERED_UNOBSERVED=" + originalSkill.id +
                    ": no original phase_random2 checker invocation in 3 source races")
                continue
            }
            val unknown = choice.predicateTypes.filter { it == "order_rate" }
            assertTrue(unknown.isNotEmpty())
            audits +=
                """{"schemaVersion":1,
                "status":"p2-15-pinned-original-registered-skill-race-tick-phase-only",
                "sourceSkillId":"${originalSkill.id}",
                "sourceOriginalInvokeIndex":${choice.invokeIndex},
                "sourceOriginalORIndex":${choice.orIndex},
                "sourceOriginalInvokeCount":$sourceInvokeCount,
                "sourceOriginalConditionsORCount":$sourceORCount,
                "sourceOriginalSelectedANDSize":$sourceANDSize,
                "sourceOriginalPreconditionORCount":$sourcePreORCount,
                "sourceOriginalCurrentANDHasOrderRate":true,
                "sourceOriginalCurrentANDHasPhaseRandom2":true,
                "originalSkillRecordEquippedUnmodified":true,
                "originalInvokeConditionsUsedUnmodified":true,
                "originalSourceConditionLogicSha256":"$sourceLogicSha256",
                "originalOrderRateWasIgnoredBySource":true,
                "actualSourceCheckerTickCount":$joined,
                "phasePredicateTrueCalls":$hits,
                "phasePredicateFalseCalls":$misses,
                "sourceModelSkillEventCount":$modelEvents,
                "realGameSkillProcObserved":false,
                "trials":[${trialRows.joinToString(",")}]}""".trimIndent().replace("\n", "")
            successful = true
            break
        }
        assertTrue(successful,
            "None of up to 12 original same-AND source skills produced original window checks")
        File(output!!).writeText(audits.single() + "\n")
    }
}
