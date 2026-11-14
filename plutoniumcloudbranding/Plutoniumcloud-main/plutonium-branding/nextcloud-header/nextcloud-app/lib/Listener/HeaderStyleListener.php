<?php
declare(strict_types=1);
namespace OCA\PlutoniumFilesBrand\Listener;
use OCP\AppFramework\Http\Events\BeforeTemplateRenderedEvent;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\IRequest;
use OCP\IUserSession;
use OCP\Util;
/** @implements IEventListener<BeforeTemplateRenderedEvent> */
final class HeaderStyleListener implements IEventListener {
    public function __construct(private IRequest $request, private IUserSession $session) {}
    public function handle(Event $event): void {
        if (!$event instanceof BeforeTemplateRenderedEvent) { return; }
        // Native UID admin is ordinary Adrian; recovery UID akadmin remains separate.
        if (!$this->session->isLoggedIn() || $this->session->getUser()?->getUID() !== 'admin') { return; }
        if (!preg_match('~^/(?:index\.php/)?apps/files(?:/[A-Za-z0-9_-]+)*/?$~D', $this->request->getPathInfo())) { return; }
        Util::addStyle('plutonium_files_brand', 'header');
    }
}
