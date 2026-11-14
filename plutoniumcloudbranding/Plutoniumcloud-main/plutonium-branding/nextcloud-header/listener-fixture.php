namespace OCP { class Util {public static array $styles=[];public static function addStyle(string $app,?string $file=null,bool $prepend=false):void{self::$styles[]=[$app,$file];}} interface IRequest {public function getPathInfo();} interface IUserSession {public function isLoggedIn();public function getUser();} }
namespace OCP\EventDispatcher { class Event {} interface IEventListener {public function handle(Event $event): void;} }

namespace OCP\AppFramework\Http\Events { class BeforeTemplateRenderedEvent extends \OCP\EventDispatcher\Event {} }
namespace {
$input=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
eval(preg_replace('/^<\?php\s*/','',$input['listener']));
$cases=[
 [true,'admin','/apps/files/',true],
 [true,'admin','/apps/files/files/42',true],
 [true,'admin','/index.php/apps/files/',true],
 [false,'admin','/apps/files/',false],
 [true,'akadmin','/apps/files/',false],
 [true,'julian','/apps/files/',false],
 [true,null,'/apps/files/',false],
 [true,'admin','/login',false],
 [true,'admin','/apps/user_oidc/login/1',false],
 [true,'admin','/settings/admin',false],
 [true,'admin','/remote.php/dav/files/admin/',false],
 [true,'admin','/apps/files_external/',false],
 [true,'admin','/apps/files_evil',false],
 [true,'admin','/apps/richdocuments/',false],
 [true,'admin','/apps/files/../settings',false],
 [true,'admin','/apps/files/%2e%2e/settings',false]
];
foreach($cases as [$logged,$uid,$path,$allowed]){
 $request=new class($path) implements \OCP\IRequest {public function __construct(private string $path){}public function getPathInfo(){return $this->path;}};
 $session=new class($logged,$uid) implements \OCP\IUserSession {public function __construct(private bool $logged,private ?string $uid){}public function isLoggedIn(){return $this->logged;}public function getUser(){return $this->uid===null?null:new class($this->uid){public function __construct(private string $uid){}public function getUID(){return $this->uid;}};}};
 $listener=new \OCA\PlutoniumFilesBrand\Listener\HeaderStyleListener($request,$session);
 \OCP\Util::$styles=[];
 $event=new \OCP\AppFramework\Http\Events\BeforeTemplateRenderedEvent();$listener->handle($event);
 if(\OCP\Util::$styles!==($allowed?[['plutonium_files_brand','header']]:[]))throw new \RuntimeException('Header scope test failed');
 \OCP\Util::$styles=[];$listener->handle(new \OCP\EventDispatcher\Event());
 if(\OCP\Util::$styles!==[])throw new \RuntimeException('Wrong event changed styling');
}
echo 'FILES_HEADER_SCOPE_TESTS_PASSED';
}
