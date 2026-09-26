import importlib.util
import math
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('roadrelay',Path(__file__).parents[1]/'server.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class ReceiverTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/'test.sqlite3'
        self.store=module.Store(self.path)

    def tearDown(self):
        self.store.db.close();self.temp.cleanup()

    def packet(self,seq=0,impact=.85,device='TEST-01',boot='test'):
        return dict(device=device,boot=boot,seq=seq,samples=[[seq*100+1,impact,2 if impact>.6 else 0]])

    def test_simulation_is_separate_and_has_twenty_distinct_vehicles(self):
        self.assertEqual(self.store.state('simulation')['stats']['vehicles'],20)
        self.assertEqual(self.store.state('simulation')['stats']['passes'],60)
        self.assertEqual(self.store.state('live')['incidents'],[])
        self.assertEqual(self.store.state('live')['samples'],[])

    def test_many_samples_one_pass_do_not_inflate_counts(self):
        self.store.start_pass('B','TEST-01')
        for seq in range(40): self.store.ingest(self.packet(seq))
        item=self.store.incidents('live')[0]
        self.assertEqual(item['vehicles'],1)
        self.assertEqual(item['abnormal_passes'],1)
        self.assertEqual(item['total_passes'],1)
        self.assertEqual(len(self.store.incidents('live')),1)

    def test_repeated_passes_merge_but_vehicles_remain_distinct(self):
        for n,device in enumerate(['TEST-01','TEST-01','TEST-02']):
            self.store.start_pass('A',device)
            self.store.ingest(self.packet(n,device=device))
            self.store.stop_pass()
        item=self.store.incidents('live')[0]
        self.assertEqual((item['vehicles'],item['abnormal_passes']),(2,3))

    def test_duplicates_and_old_packets_are_ignored_and_gaps_counted(self):
        self.assertTrue(self.store.ingest(self.packet(0)))
        self.assertFalse(self.store.ingest(self.packet(0)))
        self.assertTrue(self.store.ingest(self.packet(3)))
        self.assertFalse(self.store.ingest(self.packet(2)))
        self.assertEqual(self.store.dropped_packets,2)
        self.assertEqual(self.store.db.execute("SELECT COUNT(*) FROM samples WHERE mode='live'").fetchone()[0],2)

    def test_invalid_batch_does_not_partially_write(self):
        packet=self.packet();packet['samples']+=[[50,math.nan,2]]
        with self.assertRaises(ValueError): self.store.ingest(packet)
        self.assertEqual(self.store.state('live')['samples'],[])

    def test_without_active_pass_no_false_location_or_incident(self):
        self.store.ingest(self.packet())
        self.assertEqual(self.store.incidents('live'),[])
        self.assertIsNone(self.store.db.execute("SELECT pass_id FROM samples WHERE mode='live'").fetchone()[0])

    def test_normal_pass_is_coverage_not_incident(self):
        self.store.start_pass('A','TEST-01')
        self.store.ingest(self.packet(impact=.1))
        self.assertEqual(self.store.state('live')['stats']['covered'],1)
        self.assertEqual(self.store.incidents('live'),[])

    def test_different_device_cannot_contaminate_active_pass(self):
        self.store.start_pass('A','TEST-01');self.store.ingest(self.packet(device='OTHER'))
        self.assertEqual(self.store.incidents('live'),[])

    def test_workflow_requires_assignment_and_human_notes(self):
        iid=self.store.incidents('simulation')[0]['id']
        with self.assertRaises(ValueError): self.store.update(iid,{'status':'Repair completed'})
        with self.assertRaises(ValueError): self.store.update(iid,{'status':'Inspection assigned'})
        self.store.update(iid,{'status':'Inspection assigned','assignee':'Demo crew'})
        with self.assertRaises(ValueError): self.store.update(iid,{'status':'Confirmed','note':''})
        self.store.update(iid,{'status':'Confirmed','note':'Controlled test only.'})
        self.store.update(iid,{'status':'Repair completed','note':'Demo repair recorded.'})
        self.store.update(iid,{'status':'Recheck'})
        self.assertEqual(self.store.detail(iid)['status'],'Recheck')

    def test_records_persist_and_active_pass_does_not_resume_on_restart(self):
        self.store.start_pass('B','TEST-01');self.store.ingest(self.packet())
        self.store.db.close();self.store=module.Store(self.path)
        self.assertIsNone(self.store.active_pass)
        self.assertEqual(len(self.store.incidents('live')),1)
        self.assertEqual(self.store.state('simulation')['stats']['passes'],60)

    def test_rules_are_explicitly_not_ai_and_disclose_simulation(self):
        iid=self.store.incidents('simulation')[0]['id']
        summary=self.store.brief(iid,False)
        self.assertIn('not AI',summary['kind'])
        self.assertIn('simulated',summary['text'])
        self.assertIn('synthetic',summary['text'])

    def test_new_abnormal_pass_after_repair_creates_new_candidate(self):
        self.store.start_pass('B','TEST-01');self.store.ingest(self.packet());self.store.stop_pass()
        iid=self.store.incidents('live')[0]['id']
        self.store.update(iid,{'status':'Inspection assigned','assignee':'Test crew'})
        self.store.update(iid,{'status':'Confirmed','note':'Test finding'})
        self.store.update(iid,{'status':'Repair completed','note':'Test repair'})
        self.store.start_pass('B','TEST-01');self.store.ingest(self.packet(1))
        self.assertEqual(len(self.store.incidents('live')),2)


if __name__=='__main__': unittest.main()
