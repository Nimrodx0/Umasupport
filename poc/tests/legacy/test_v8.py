import unittest, json, pathlib, importlib.util, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('build_v8',ROOT/'tools/build_v8.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class BuildV8Test(unittest.TestCase):
 def test_preview(self):
  d=m.make_payload(ROOT/'inputs/umasim_excerpt.psv')
  self.assertEqual(d['meta']['idMappedCards'],31)
  self.assertEqual(d['meta']['deduplicatedCandidates'],0)
  self.assertEqual(len(d['cards']),581)
  self.assertEqual(d['meta']['hintsTotal'],192)
  self.assertTrue(any(c['id']=='10006' and len(c['hints'])==14 for c in d['cards']))
  self.assertTrue(any(c['id']=='10020' and c['hints']==[] and c['sourceStatus']=='verified_hints' for c in d['cards']))
  self.assertTrue(any(c['id']=='30289' and len(c['events'])==3 for c in d['cards']))
  self.assertTrue(len(d['meta']['aliasCardIds'])==31)
  self.assertGreaterEqual(len(set(c['id'] for c in d['cards'])),581)
 def test_strict_full_rejects_excerpt(self):
  with self.assertRaisesRegex(ValueError,'Full build requires'):
   m.make_payload(ROOT/'inputs/umasim_excerpt.psv',require_full=True)
 def test_native_stage_parse(self):
  with tempfile.TemporaryDirectory() as td:
   p=pathlib.Path(td)/'support_card.txt'
   def row(stage,skills):
    cols=['10001','[トレセン学園]スペシャルウィーク','スペシャルウィーク','1',str(stage),'20','根性']+['0']*50+[skills,'スピード:1','']
    return '\t'.join(cols)
   p.write_text(row(0,'末脚')+'\n'+row(4,'直線巧者, 地固め'))
   data=m.read_support_cards(p)
   self.assertEqual(data['10001']['stageHints']['0'],['末脚'])
   self.assertEqual(data['10001']['stageHints']['4'],['直線巧者','地固め'])
 def test_duplicate_mapping_and_distinct_cards(self):
  d=m.make_payload(ROOT/'inputs/full_support_hints.psv',require_full=True)
  self.assertEqual(len(d['cards']),564)
  self.assertEqual(d['meta']['sourceStatuses']['catalog_only'],1)
  self.assertEqual(d['meta']['idMappedCards'],563)
  self.assertEqual(d['meta']['hintsTotal'],4015)
  self.assertEqual(d['meta']['deduplicatedCandidates'],30)
  ids=[x['id'] for x in d['cards']]
  self.assertEqual(len(ids),len(set(ids)))
  for old,new in [('catalog-1o7925v','30079'),('catalog-1m027qj','30304'),('catalog-lyec2f','30320'),('catalog-16orarl','30231')]:
   self.assertEqual(d['meta']['aliasCardIds'][old],new)
   self.assertNotIn(old,ids)
   self.assertIn(new,ids)
  # Similar names, different actual cards/rarities must be retained.
  meisho=[x for x in d['cards'] if x.get('character')=='メイショウドトウ']
  self.assertEqual({x['id'] for x in meisho},{'30079','30230','20017','10045','30304'})
  self.assertEqual(len([x for x in d['cards'] if x.get('sourceStatus')=='catalog_only']),1)
  self.assertTrue(any('トレセン学園' in x['name'] and 'タッカーブライン' in x['name'] for x in d['cards'] if x.get('sourceStatus')=='catalog_only'))
 def test_no_browser_network(self):
  html=(ROOT/'uma_support_lab_v8_1.html').read_text()
  self.assertNotIn('fetch(',html)
  self.assertNotIn('https://raw.githubusercontent',html)
  self.assertNotIn('全カード台帳を取得',html)
if __name__=='__main__':unittest.main()