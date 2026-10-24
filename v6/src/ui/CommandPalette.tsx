import { useEffect, useRef, useState } from 'react';
export function CommandPalette({ go }: { go: (page: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const commands = [
    ['Tổng quan', 'overview'],
    ['Dữ liệu phân tích', 'evidence'],
    ['Cloud và khôi phục', 'cloud'],
    ['Lịch', 'calendar'],
    ['Review', 'review'],
    ['Setup', 'playbook'],
    ['Phân tích nâng cao', 'advanced'],
    ['Cài đặt và nhập Binance', 'settings'],
    ['Giới thiệu và FAQ', 'welcome'],
  ];
  const filtered = commands.filter((c) =>
    c[0].toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')),
  );
  const open = () => {
    if (!document.querySelector('dialog[open]')) {
      dialog.current?.showModal();
      input.current?.focus();
    }
  };
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, []);
  const choose = (page: string) => {
    dialog.current?.close();
    setQuery('');
    go(page);
  };
  return (
    <>
      <button onClick={open}>Tìm lệnh · Ctrl+K</button>
      <dialog ref={dialog} aria-label="Bảng lệnh">
        <label>
          Tìm chức năng
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const value = e.currentTarget.value.toLocaleLowerCase('vi');
                const match = commands.find((c) => c[0].toLocaleLowerCase('vi').includes(value));
                if (match) choose(match[1]);
              }
            }}
          />
        </label>
        {filtered.map(([name, page]) => (
          <p key={page}>
            <button onClick={() => choose(page)}>{name}</button>
          </p>
        ))}
        <button onClick={() => dialog.current?.close()}>Đóng bảng lệnh</button>
      </dialog>
    </>
  );
}
