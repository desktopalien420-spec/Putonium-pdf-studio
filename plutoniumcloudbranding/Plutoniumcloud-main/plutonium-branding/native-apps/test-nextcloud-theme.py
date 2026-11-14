from pathlib import Path
import ast,copy,json,tempfile,unittest
from types import SimpleNamespace as NS
SOURCE=Path('plutonium-branding/native-apps/apply-nextcloud-theme.py').read_text(encoding='utf-8');TREE=ast.parse(SOURCE)
class Stop(RuntimeError):pass
class Guards(unittest.TestCase):
 def setUp(self):
  self.ns={'Stop':Stop};self.saved=[];self.writes=[];self.health_fail=False
  for node in TREE.body:
   if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='AFTER' for t in node.targets):self.ns['AFTER']=ast.literal_eval(node.value)
  self.ns['KEYS']=tuple(self.ns['AFTER'])
  functions=[n for n in TREE.body if isinstance(n,ast.FunctionDef) and n.name in ['need','target','validate_state','validate_resume','apply_remaining','rollback']];exec(compile(ast.Module(body=functions,type_ignores=[]),'<reviewed-theme-functions>','exec'),self.ns)
  self.before={k:{'exists':False,'value':None} for k in self.ns['KEYS']};self.after=self.ns['target']();self.current=copy.deepcopy(self.after)
  self.state={'before':self.before,'after':self.after};self.unrelated={'logo':'keep','disable-user-theming':'no','privacyUrl':'keep'}
  self.ns['read']=lambda h:copy.deepcopy(self.current)
  def write(h,key,value):self.writes.append(key);self.current[key]=copy.deepcopy(value)
  def health(h):
   if self.health_fail:raise Stop('unrelated HTTPS failed')
  self.ns['set_value']=write;self.ns['health']=health;self.ns['save']=lambda s:self.saved.append(copy.deepcopy(s))
 def test_restore_only_owned_settings_and_absence(self):
  self.ns['rollback'](None,self.state);self.assertEqual(self.current,self.before);self.assertEqual(len(self.writes),5);self.assertEqual(self.unrelated,{'logo':'keep','disable-user-theming':'no','privacyUrl':'keep'})
 def test_conflicting_newer_theme_refused_before_mutation(self):
  self.current['name']={'exists':True,'value':'A newer choice'}
  with self.assertRaises(Stop):self.ns['rollback'](None,self.state)
  self.assertEqual(self.writes,[])
 def test_partial_install_restores_before_and_after_values(self):
  self.current['name']=copy.deepcopy(self.before['name']);self.ns['rollback'](None,self.state);self.assertEqual(self.current,self.before);self.assertEqual(len(self.writes),4)
 def test_unrelated_outage_does_not_block_settings_restoration(self):
  self.health_fail=True
  with self.assertRaises(Stop):self.ns['rollback'](None,self.state)
  self.assertEqual(self.current,self.before);self.assertEqual(self.saved[-1]['phase'],'appearance_restored_verification_pending')
 def test_unreviewed_state_refused(self):
  self.state['after']['name']['value']='unreviewed'
  with self.assertRaises(Stop):self.ns['rollback'](None,self.state)
  self.assertEqual(self.writes,[])
 def test_masked_list_url_reads_only_owned_key_specific_getters(self):
  node=next(n for n in TREE.body if isinstance(n,ast.FunctionDef) and n.name=='read')
  scope=dict(self.ns);exec(compile(ast.Module(body=[node],type_ignores=[]),'<actual-theme-read>','exec'),scope)
  calls=[]
  def getter(args):
   calls.append(args);return self.ns['AFTER'][args[-2]]
  h=NS(occ=lambda *a:{'apps':{'theming':{'name':'Plutonium Cloud','url':'***REMOVED SENSITIVE VALUE***','unrelated_secret':'never fetch'}}},run=getter)
  result=scope['read'](h)
  self.assertEqual(result['url'],self.after['url']);self.assertEqual({args[-2] for args in calls},{'name','url'});self.assertEqual(result['slogan'],self.before['slogan'])
 def test_failed_owned_getter_is_not_treated_as_missing_or_as_a_mask(self):
  node=next(n for n in TREE.body if isinstance(n,ast.FunctionDef) and n.name=='read');scope=dict(self.ns);exec(compile(ast.Module(body=[node],type_ignores=[]),'<actual-theme-read>','exec'),scope)
  def fail(args):raise Stop('getter failed')
  with self.assertRaises(Stop):scope['read'](NS(occ=lambda *a:{'apps':{'theming':{'url':'***MASKED***'}}},run=fail))
 def test_resume_finishes_only_remaining_three_and_preserves_original_backup(self):
  self.state['phase']='prepared';self.current=copy.deepcopy(self.before)
  for key in ['name','url']:self.current[key]=copy.deepcopy(self.after[key])
  original=copy.deepcopy(self.state['before']);self.ns['validate_resume'](self.state,self.current);self.ns['apply_remaining'](None,self.state,copy.deepcopy(self.current))
  self.assertEqual(self.writes,['slogan','primary_color','background_color']);self.assertEqual(self.current,self.after);self.assertEqual(self.state['before'],original)
 def test_resume_refuses_newer_value(self):
  self.state['phase']='prepared';self.current['slogan']={'exists':True,'value':'newer choice'}
  with self.assertRaises(Stop):self.ns['validate_resume'](self.state,self.current)
  self.assertEqual(self.writes,[])
 def test_resume_refuses_already_accepted_or_rolled_back_phase(self):
  for phase in ['awaiting_browser_acceptance','rolled_back']:
   self.state['phase']=phase
   with self.assertRaises(Stop):self.ns['validate_resume'](self.state,self.current)
 def test_remaining_apply_refuses_concurrent_change_before_any_write(self):
  self.current=copy.deepcopy(self.before);expected=copy.deepcopy(self.current);self.current['name']={'exists':True,'value':'concurrent'}
  with self.assertRaises(Stop):self.ns['apply_remaining'](None,self.state,expected)
  self.assertEqual(self.writes,[])
if __name__=='__main__':unittest.main(verbosity=2)
