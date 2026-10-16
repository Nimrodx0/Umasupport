"""No external files: synthetic group-rate and explicit-ID comparison regression."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from verify_skill_master import read_umasim
from audit_independent_skill_json import read_independent, compare


def fixtures():
    original = [
        {"id":"700004","name":"架空金","group":70000,"rarity":"rare"},
        {"id":"700002","name":"右回り◎","group":70000,"rarity":"normal"},
        {"id":"700001","name":"右回り○","group":70000,"rarity":"normal"},
        {"id":"700014","name":"単純金","group":70001,"rarity":"rare"},
        {"id":"700012","name":"単純白","group":70001,"rarity":"normal"},
        {"id":"700024","name":"単独金","group":70002,"rarity":"rare"},
    ]
    independent = []
    def item(sid, group, rate, rarity, lower=None, upper=None):
        return {"id":int(sid),"name":"test","groupId":group,"groupRate":rate,
                "rarity":rarity,"lowerSkillId":lower,"upperSkillId":upper}
    independent.extend([
        item("700004",70000,3,2,700002),
        item("700002",70000,2,1,700001,700004),
        item("700001",70000,1,1,None,700002),
        item("700014",70001,2,2,700012),
        item("700012",70001,1,1,None,700014),
        item("700024",70002,1,2),
    ])
    for i in range(110):
        original.append({"id":str(800000+i),"name":"無関係"+str(i),
                         "group":(800000+i)//10,"rarity":"normal"})
        independent.append(item(str(800000+i),(800000+i)//10,i%10,1))
    return original, independent


class IndependentSkillsTests(unittest.TestCase):
    def audit(self,modify=None):
        source, other = fixtures()
        if modify:
            modify(source,other)
        return compare(read_umasim(json.dumps(source)),
                       read_independent(json.dumps(other)))

    def test_all_three_chains_and_pointers(self):
        r = self.audit()
        self.assertTrue(r["allConfirmedInIndependentSnapshot"])
        self.assertEqual(r["matchingChains"],2)
        self.assertEqual(r["matchingNoLowerSnapshot"],1)
        self.assertEqual(r["pointerEvidence"]["threeStepChainsAgreed"],1)
        self.assertEqual(r["pointerEvidence"]["chainsWithCompleteConsistentPointers"],2)

    def test_missing_member_is_not_a_pass(self):
        r = self.audit(lambda s,i: i.__setitem__(slice(None),[v for v in i if v["id"]!=700002]))
        self.assertFalse(r["allConfirmedInIndependentSnapshot"])
        self.assertEqual(r["statusCounts"]["missing_ids"],1)

    def test_group_and_rarity_mismatches(self):
        def change(s,i):
            next(v for v in i if v["id"]==700012)["rarity"]=2
        self.assertEqual(self.audit(change)["statusCounts"]["metadata_mismatch"],1)

    def test_wrong_circle_order(self):
        def change(s,i):
            next(v for v in i if v["id"]==700002)["groupRate"]=0
        self.assertEqual(self.audit(change)["statusCounts"]["rank_mismatch"],1)

    def test_conflicting_explicit_link_is_not_ignored(self):
        def change(s,i):
            next(v for v in i if v["id"]==700004)["lowerSkillId"]=700001
        self.assertEqual(self.audit(change)["statusCounts"]["explicit_link_conflict"],1)

    def test_negative_rate_extra_is_ignored_as_nonpromotion(self):
        def change(s,i):
            i.append({"id":700003,"name":"extra","groupId":70000,
                      "groupRate":-1,"rarity":1,
                      "lowerSkillId":None,"upperSkillId":None})
        self.assertTrue(self.audit(change)["allConfirmedInIndependentSnapshot"])

    def test_null_pointer_is_not_fully_confirmed(self):
        def change(s,i):
            next(v for v in i if v["id"]==700004)["lowerSkillId"]=None
        r = self.audit(change)
        self.assertFalse(r["allConfirmedInIndependentSnapshot"])
        self.assertEqual(r["statusCounts"]["explicit_links_incomplete"],1)

    def test_nonnegative_extra_blocks_confirmation(self):
        def change(s,i):
            i.append({"id":700003,"name":"extra","groupId":70000,
                      "groupRate":4,"rarity":1,
                      "lowerSkillId":None,"upperSkillId":None})
        self.assertEqual(self.audit(change)["statusCounts"]["extra_group_members"],1)

    def test_independent_duplicate_ids_rejected(self):
        _,i=fixtures()
        i.append(dict(i[0]))
        with self.assertRaisesRegex(ValueError,"Duplicate"):
            read_independent(json.dumps(i))

    def test_invalid_schema_rejected(self):
        _,i=fixtures()
        i[0].pop("groupRate")
        with self.assertRaisesRegex(ValueError,"Missing"):
            read_independent(json.dumps(i))


if __name__=="__main__":
    unittest.main()
