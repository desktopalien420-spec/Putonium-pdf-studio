"""Exercise the actual RPC guard/update functions with isolated model fixtures."""
import ast,base64,contextlib,copy,hashlib,io,json,re,sys,tempfile,unittest,urllib.parse
from pathlib import Path
from types import SimpleNamespace as NS

ROOT=Path(__file__).resolve().parent
SOURCE=(ROOT/'apply-branding.py').read_text(encoding='utf-8')
TREE=ast.parse(SOURCE)
def constant(name):
    return ast.literal_eval(next(n.value for n in TREE.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id==name for t in n.targets)))
META=constant('META');FIELDS=constant('FIELDS');PREFIX=constant('PREFIX');BRAND=constant('BRAND');FLOW=constant('FLOW')
RPC=constant('RPC')
for token,value in [('__BRAND__',BRAND),('__FLOW__',FLOW),('__FIELDS__',FIELDS),('__PREFIX__',PREFIX),('__FILE_HASHES__',META['files'])]:RPC=RPC.replace(token,repr(value))
FUNCTIONS=[n for n in ast.parse(RPC).body if isinstance(n,ast.FunctionDef)]
class Record:
    def __init__(self,**kwargs):
        self.__dict__.update(kwargs);self.saved=[];self._meta=NS(concrete_fields=[NS(name=k,attname=k) for k in kwargs if k!='pk'])
    def save(self,update_fields):self.saved.append(list(update_fields))
class Manager:
    def __init__(self,item):self.item=item
    def get(self,**kwargs):assert str(self.item.pk)==kwargs['pk'];return self.item
    def select_for_update(self):return self
class Guards(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='plutonium-theme-guards-');self.path=Path(self.tmp.name)
        self.brand=Record(pk=BRAND,brand_uuid=BRAND,domain='authentik-default',default=True,flow_authentication_id=None,attributes={'mfa':'unchanged'},**{k:('authentik' if k=='branding_title' else '') for k in FIELDS})
        self.brand.client_certificates=NS(values_list=lambda *a,**k:[])
        self.flow=Record(pk=FLOW,flow_uuid=FLOW,slug='default-authentication-flow',designation='authentication',title='Welcome to authentik!',compatibility_mode=False)
        self.bindings=[{'pk':'binding-a','target_id':FLOW,'stage_id':'unchanged-mfa','order':20}]
        self.readonly=[]
        class Cursor:
            def __enter__(me):return me
            def __exit__(me,*a):pass
            def execute(me,sql):self.readonly.append(sql)
        @contextlib.contextmanager
        def atomic():
            oldb={k:copy.deepcopy(getattr(self.brand,k)) for k in FIELDS};oldf=self.flow.title
            try:yield
            except Exception:
                for k,v in oldb.items():setattr(self.brand,k,v)
                self.flow.title=oldf;raise
        backend=NS(name='file',base_path=self.path)
        def save_file(name,data):
            p=self.path/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        self.ns={'base64':base64,'hashlib':hashlib,'json':json,'sys':NS(stdin=None),'Path':Path,'connection':NS(cursor=lambda:Cursor()),'transaction':NS(atomic=atomic),'Brand':NS(objects=Manager(self.brand)),'Flow':NS(objects=Manager(self.flow)),'FlowStageBinding':NS(objects=NS(filter=lambda **kw:NS(values=lambda:copy.deepcopy(self.bindings)))),'BRAND':BRAND,'FLOW':FLOW,'FIELDS':FIELDS,'PREFIX':PREFIX,'FILE_HASHES':META['files'],'get_file_manager':lambda _:NS(management_backend=backend,manageable=True),'FileUsage':NS(MEDIA='media')}
        exec(compile(ast.Module(body=FUNCTIONS,type_ignores=[]),'<actual-brand-rpc>','exec'),self.ns)
        self.actual_media=self.ns['media'];self.ns['media']=lambda:(NS(save_file=save_file),backend)
        self.before=self.call({'action':'snapshot'})
        self.after={'branding_title':'Plutonium Cloud','branding_logo':PREFIX+'wordmark.svg','branding_favicon':PREFIX+'favicon.svg','branding_default_flow_background':PREFIX+'background.svg','branding_custom_css':(ROOT/'authentik.css').read_bytes().decode('utf-8')}
        self.assets={n:base64.b64encode((ROOT/'assets'/n).read_bytes()).decode() for n in ['wordmark.svg','favicon.svg','background.svg']}
    def tearDown(self):self.tmp.cleanup()
    def call(self,payload):self.ns['sys'].stdin=io.StringIO(json.dumps(payload));return self.ns['main']()
    def apply(self):return self.call({'action':'apply','before':self.before,'after':self.after,'assets':self.assets})
    def test_snapshot_has_no_model_writes(self):
        self.assertEqual(self.brand.saved,[]);self.assertEqual(self.flow.saved,[]);self.assertTrue(self.before['asset_paths_available']);self.assertTrue(any('read_only' in x for x in self.readonly))
    def test_apply_changes_only_presentation_and_title(self):
        self.assertTrue(self.apply()['guard_unchanged']);self.assertEqual(self.brand.saved,[FIELDS]);self.assertEqual(self.flow.saved,[['title']]);self.assertEqual(self.brand.attributes,{'mfa':'unchanged'});self.assertEqual(self.bindings[0]['stage_id'],'unchanged-mfa')
        result=self.call({'action':'verify','before':self.before,'after':self.after});self.assertEqual(result['guard'],self.before['guard'])
    def test_concurrent_auth_change_refused_before_asset_write(self):
        self.bindings[0]['order']=99
        with self.assertRaises(AssertionError):self.apply()
        self.assertEqual(self.brand.saved,[]);self.assertFalse((self.path/PREFIX).exists())
    def test_unreviewed_css_or_asset_refused(self):
        self.after['branding_custom_css']+='\nbody{display:none}'
        with self.assertRaises(AssertionError):self.apply()
        self.assertFalse((self.path/PREFIX).exists())
    def test_rollback_restores_owned_fields_preserving_later_unrelated_changes_and_assets(self):
        self.apply();self.brand.attributes['later_policy']='preserve'
        result=self.call({'action':'rollback','before':self.before,'after':self.after});self.assertTrue(result['restored']);self.assertFalse(result['original_guard_matches']);self.assertEqual(self.brand.attributes['later_policy'],'preserve');self.assertTrue((self.path/PREFIX/'wordmark.svg').exists());self.assertEqual(self.flow.title,self.before['flow_title'])
    def test_rollback_refuses_newer_presentation(self):
        self.apply();self.brand.branding_title='Newer owner choice'
        with self.assertRaises(AssertionError):self.call({'action':'rollback','before':self.before,'after':self.after})
        self.assertEqual(self.brand.branding_title,'Newer owner choice')
    def test_recovery_restores_before_checking_unrelated_service_health(self):
        node=next(n for n in ast.parse((ROOT/'apply-branding.py').read_text(encoding='utf-8')).body if isinstance(n,ast.FunctionDef) and n.name=='rollback')
        events=[];saved=[]
        def rpc(payload):events.append('restored');return {'restored':True,'original_guard_matches':True}
        def health(_):events.append('health');raise RuntimeError('Simulated unrelated service outage')
        ns={'rpc':rpc,'health':health,'save':lambda value:saved.append(copy.deepcopy(value)),'need':lambda ok,msg:None if ok else (_ for _ in ()).throw(RuntimeError(msg))}
        exec(compile(ast.Module(body=[node],type_ignores=[]),'<recovery-order-check>','exec'),ns)
        with self.assertRaises(RuntimeError):ns['rollback'](None,{'before':self.before,'after':self.after})
        self.assertEqual(events,['restored','health']);self.assertEqual(saved[0]['phase'],'presentation_restored_verification_pending')
    def test_media_outside_verified_mount_refused(self):
        with self.assertRaises(AssertionError):self.actual_media()
    def test_asset_verification_preserves_signed_query_but_refuses_other_origins_and_paths(self):
        selected=[n for n in TREE.body if isinstance(n,ast.ClassDef) and n.name=='Stop' or isinstance(n,ast.FunctionDef) and n.name in ['need','asset_request_path']]
        ns={'urllib':urllib,'PREFIX':PREFIX};exec(compile(ast.Module(body=selected,type_ignores=[]),'<asset-path-guard>','exec'),ns)
        good='/files/media/public/'+PREFIX+'wordmark.svg?token=TEST_ONLY'
        self.assertEqual(ns['asset_request_path']('https://auth.plutoniumcloud.com'+good),good)
        for bad in ['http://auth.plutoniumcloud.com'+good,'https://evil.invalid'+good,'/files/media/public/'+PREFIX+'../wordmark.svg',good+'#fragment']:
            with self.assertRaises(ns['Stop']):ns['asset_request_path'](bad)

if __name__=='__main__':unittest.main(verbosity=2)
