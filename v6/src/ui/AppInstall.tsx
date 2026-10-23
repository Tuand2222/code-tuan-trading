import { useEffect, useState } from 'react';
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function AppInstall() {
  const [install, setInstall] = useState<InstallEvent>(),
    [update, setUpdate] = useState(false),
    [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  useEffect(() => {
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', prompt);
    let active = true;
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.ready.then((r) => {
        if (!active) return;
        setRegistration(r);
        if (r.waiting) setUpdate(true);
        const found = () => {
          const worker = r.installing;
          if (worker)
            worker.addEventListener('statechange', () => {
              if (active && worker.state === 'installed' && navigator.serviceWorker.controller)
                setUpdate(true);
            });
        };
        r.addEventListener('updatefound', found);
        void r.update().catch(() => {});
      });
    return () => {
      active = false;
      window.removeEventListener('beforeinstallprompt', prompt);
    };
  }, []);
  return (
    <div className="actions">
      {install && (
        <button
          onClick={() =>
            void install
              .prompt()
              .then(() => install.userChoice)
              .then(() => setInstall(undefined))
          }
        >
          Cài ứng dụng trên thiết bị
        </button>
      )}
      {update && (
        <button
          onClick={() => {
            if (document.querySelector('dialog[open]')) return;
            if (registration?.waiting) {
              navigator.serviceWorker.addEventListener(
                'controllerchange',
                () => location.reload(),
                { once: true },
              );
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              setTimeout(() => location.reload(), 1500);
            } else location.reload();
          }}
        >
          Có bản mới · lưu biểu mẫu rồi tải lại
        </button>
      )}
    </div>
  );
}
