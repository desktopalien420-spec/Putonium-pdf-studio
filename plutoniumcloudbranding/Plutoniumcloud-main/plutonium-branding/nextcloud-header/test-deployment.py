from pathlib import Path
import ast,copy,hashlib,io,json,tarfile,unittest
from types import SimpleNamespace as NS
BASE=Path(__file__).resolve().parent;TREE=ast.parse((BASE/'deploy-nextcloud-header.py').read_text(encoding='utf-8'))
class Stop(RuntimeError):pass
class Guards(unittest.TestCase):
 def setUp(self):
  meta=ast.literal_eval(next(n.value for n in TREE.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='META' for t in n.targets)))
  self.ns={'Stop':Stop,'Path':Path,'hashlib':hashlib,'io':io,'json':json,'tarfile':tarfile,'HERE':BASE,'META':meta,'APP_ID':'plutonium_files_brand','CONTAINER':'nextcloud-aio-nextcloud'}
  functions=[n for n in TREE.body if isinstance(n,ast.FunctionDef) and n.name in ['need','sha','unpack','app_files','listing','rollback']];exec(compile(ast.Module(body=functions,type_ignores=[]),'<actual-header-functions>','exec'),self.ns)
  self.enabled={'plutonium_files_brand':'0.1.0','plutonium_desktop_frame':'0.1.0','theming':'2.9.0'};self.calls=[];self.saved=[];self.health_fail=False;self.source_changed=False
  self.h=NS(occ=lambda *a:{'enabled':dict(self.enabled)})
  def run(args):
   self.calls.append(args)
   assert args[-3:]==['app:disable','plutonium_files_brand','--no-interaction']
   self.enabled.pop('plutonium_files_brand',None)
  def source(data):
   if self.source_changed:raise Stop('newer source')
  def health(h):
   if self.health_fail:raise Stop('unrelated outage')
  self.ns.update(run=run,verify_source=source,health=health,save=lambda state:self.saved.append(copy.deepcopy(state)))
  self.state={'app_id':'plutonium_files_brand','payload':meta['payload'],'phase':'enabled_verification_pending'}
 def test_rollback_disables_only_header_and_retains_framing_theme(self):
  self.ns['rollback'](self.h,self.state,{})
  self.assertEqual(self.enabled,{'plutonium_desktop_frame':'0.1.0','theming':'2.9.0'});self.assertEqual(len(self.calls),1);self.assertEqual(self.saved[-1]['phase'],'rolled_back_source_retained')
 def test_health_failure_occurs_after_disable_and_pending_state(self):
  self.health_fail=True
  with self.assertRaises(Stop):self.ns['rollback'](self.h,self.state,{})
  self.assertNotIn('plutonium_files_brand',self.enabled);self.assertEqual(self.saved[-1]['phase'],'disabled_verification_pending')
 def test_newer_app_version_not_disabled(self):
  self.enabled['plutonium_files_brand']='0.2.0'
  with self.assertRaises(Stop):self.ns['rollback'](self.h,self.state,{})
  self.assertEqual(self.calls,[])
 def test_newer_app_source_not_disabled(self):
  self.source_changed=True
  with self.assertRaises(Stop):self.ns['rollback'](self.h,self.state,{})
  self.assertEqual(self.calls,[])
 def test_tampered_state_not_used(self):
  self.state['app_id']='another_app'
  with self.assertRaises(Stop):self.ns['rollback'](self.h,self.state,{})
  self.assertEqual(self.calls,[])
 def test_archive_exact_seven_files_six_native_app_files(self):
  data=self.ns['unpack']();self.assertEqual(len(data),7);self.assertEqual(len(self.ns['app_files'](data)),6)
if __name__=='__main__':unittest.main(verbosity=2)
