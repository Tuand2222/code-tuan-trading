import { useEffect, useRef, type ReactNode } from 'react';
export function Modal({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const el = ref.current;
    return () => el?.close();
  }, []);
  return (
    <dialog
      className="panel modal"
      ref={ref}
      aria-labelledby={label}
      onCancel={onClose}
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}
