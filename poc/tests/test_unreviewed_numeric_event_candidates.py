import copy
import hashlib
import importlib.util
import json
from pathlib import Path
from unittest import TestCase, main
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]/"tools"/"audit_unreviewed_numeric_event_candidates.py"
spec=importlib.util.spec_from_file_location("audit_event_candidates", ROOT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def fixture():
    ids=[30311]+list(range(30001,30045))
    supports=[{"id":i,"name":"Test "+str(i)} for i in ids]
    arr=[]
    for index,card in enumerate(ids):
        n=3 if index<34 else 2
        for j in range(n):
            story=830311003 if index==0 and j==0 else 830000000+(index+1)*1000+j
            event={
                "id":f"evt_{card}_{story}",
                "selection":"auto",
                "skills":[{"skillId":204532,"skillName":"華麗な踏み込み","hintLevel":1}]
            }
            if index==0 and j==0:
                event["selection"]="single"
                event.pop("skills")
                event["choices"]=[
                    {"id":"yes","skills":[
                        {"skillId":204532,"skillName":"華麗な踏み込み","hintLevel":5},
                        {"skillId":204701,"skillName":"素質の証明","hintLevel":2},
                        {"skillId":204531,"skillName":"清麗高雅","hintLevel":2}
                    ]},
                    {"id":"no","skills":[{"skillId":204532,"skillName":"華麗な踏み込み","hintLevel":1}]},
                    {"id":"other","skills":[{"skillId":204532,"skillName":"華麗な踏み込み","hintLevel":1}]}
                ]
                event["defaultChoiceId"]="yes"
            arr.append(event)
    for nonstory in sorted(mod.NUMERIC_NONSTORY):
        arr.append({"id":nonstory,"selection":"auto","skills":[
            {"skillId":204532,"skillName":"華麗な踏み込み","hintLevel":1}
        ]})
    assert len(arr)==126
    manifest={"schemaVersion":1,"datasetVersion":mod.EXPECTED_VERSION,
      "generatedAt":"2026-10-04T00:00:00Z",
      "source":{"factory":"umamusume-data-src","extractedAt":"2026-09-30T00:00:00Z"},
      "files":{k:{"path":v,"sha256":"a"*64} for k,v in mod.SOURCE_FILE_KEYS.items()}}
    skills={"204532":"華麗な踏み込み","204701":"素質の証明","204531":"清麗高雅"}
    return manifest,supports,{"version":2,"prioritySupportIds":ids,"events":arr},{str(i) for i in ids},skills

class EventCandidateAuditTest(TestCase):
    def test_45_card_126_event_scope_and_no_content_output(self):
        m,c,e,ids,skills=fixture()
        r=mod.audit(m,c,e,ids,skills)
        self.assertEqual(r["curatedSupportCards"],45)
        self.assertEqual(r["curatedEventRecords"],126)
        self.assertEqual(r["numericCardAndStoryIdPairs"],124)
        self.assertEqual(r["nonCanonicalEventIdentifierCount"],2)
        self.assertEqual(r["candidateSelectionModes"],{"auto":125,"single":1})
        self.assertEqual(r["referencedSkillIdsAbsentFromPinnedUmaSim"],0)
        self.assertEqual(r["gameRewardClaimsApproved"],0)
        self.assertFalse(r["focus30311GameWithSpotCheck"]["lowerSuccessTierRepresented"])
        self.assertNotIn("Test 30001",str(r))
    def test_malformed_skill_id_and_unknown_id_are_distinct(self):
        m,c,e,ids,skills=fixture()
        bad=copy.deepcopy(e)
        bad["events"][0]["choices"][0]["skills"][0]["skillId"]=-3
        with self.assertRaisesRegex(ValueError,"Invalid numeric"):
            mod.audit(m,c,bad,ids,skills)
        unknown=copy.deepcopy(e)
        unknown["events"][0]["choices"][0]["skills"][0]["skillId"]=999999
        r=mod.audit(m,c,unknown,ids,skills)
        self.assertEqual(r["referencedSkillIdsAbsentFromPinnedUmaSim"],1)
        self.assertEqual(r["unmatchedSkillIds"],["999999"])
    def test_missing_choice_or_nonstory_group_rejected(self):
        m,c,e,ids,skills=fixture()
        bad=copy.deepcopy(e)
        bad["events"][0]["defaultChoiceId"]="not-listed"
        with self.assertRaisesRegex(ValueError,"Default choice"):
            mod.audit(m,c,bad,ids,skills)
        bad=copy.deepcopy(e)
        bad["events"][-1]["id"]="evt_bogus"
        with self.assertRaisesRegex(ValueError,"non-story"):
            mod.audit(m,c,bad,ids,skills)
    def test_missing_support_or_duplicate_event_rejected(self):
        m,c,e,ids,skills=fixture()
        bad=copy.deepcopy(c)
        bad[1]["id"]=bad[0]["id"]
        with self.assertRaisesRegex(ValueError,"Duplicate support"):
            mod.audit(m,bad,e,ids,skills)
        bad=copy.deepcopy(e)
        bad["events"][1]["id"]=bad["events"][0]["id"]
        with self.assertRaisesRegex(ValueError,"Duplicate"):
            mod.audit(m,c,bad,ids,skills)
    def test_source_manifest_schema_and_hash_provenance(self):
        m,*_=fixture()
        self.assertEqual(mod.read_manifest(json.dumps(m).encode())["datasetVersion"],"0.1.14")
        x=copy.deepcopy(m)
        x["datasetVersion"]="0.1.15"
        with self.assertRaisesRegex(ValueError,"dataset"):
            mod.read_manifest(json.dumps(x).encode())
        x=copy.deepcopy(m)
        x["source"]["factory"]="undisclosed"
        with self.assertRaisesRegex(ValueError,"private"):
            mod.read_manifest(json.dumps(x).encode())
    def test_corrupted_game_skill_name_and_success_tier_are_not_accepted(self):
        m,c,e,ids,skills=fixture()
        bad=copy.deepcopy(e)
        bad["events"][0]["choices"][0]["skills"][0]["hintLevel"]=1
        with self.assertRaisesRegex(ValueError,"success-tier"):
            mod.audit(m,c,bad,ids,skills)
        r=mod.audit(m,c,e,ids,{"204532":"Changed name","204701":"素質の証明","204531":"清麗高雅"})
        self.assertEqual(r["skillNameDisagreementsVsPinnedUmaSim"],1)
        self.assertEqual(r["skillNameMismatchIds"],["204532"])
    def test_wiki_30311_partial_overlap_counts_not_full_coverage(self):
        m,c,e,ids,skills=fixture()
        # Rendered page's 3 chain and 2 other IDs; only one matches toy data.
        def links(values):
            return "".join(f'<a href="/Game:Training_Event_{i}">{i}</a>' for i in values)
        html=('<h2 id="Training_Events">Events</h2><h3 id="Event_Chain">Chain</h3>'+
              links(["830311003","830311088","830311089"])+
              '<h3 id="Other_Events">Other</h3>'+links(["801146002","801146003"])+
              '<h2 id="Other">Other</h2>')
        wiki={"parse":{"title":"Game:SSR Efforia (As if Guided)","revid":74431,"text":html}}
        r=mod.audit(m,c,e,ids,skills,wiki)
        self.assertEqual(r["wiki30311"]["wikiRenderedEventIds"],5)
        self.assertEqual(r["wiki30311"]["commonNumericStoryIds"],1)
        self.assertEqual(r["wiki30311"]["onWikiButNotInCandidate"],4)
    def test_umasim_pinning_fails_closed_when_bytes_change(self):
        raw=b"synthetic file contents"
        with patch.object(mod,"UMA_SUPPORT_SHA",mod.sha(raw)):
            with self.assertRaisesRegex(ValueError,"source support-card row"):
                mod.cards_from_umasim(raw)
        with self.assertRaisesRegex(ValueError,"SHA mismatch"):
            mod.cards_from_umasim(raw)

if __name__=="__main__":
    main()
