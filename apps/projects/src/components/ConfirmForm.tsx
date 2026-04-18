"use client";

/**
 * ConfirmForm — wraps a server action in a <form> that shows a browser
 * confirm dialog before submitting. Safe to render inside Server Components
 * because the server action is passed as a prop, not serialised inline.
 */

interface Props {
  action: () => Promise<void>;
  message?: string;
  children: React.ReactNode;
  className?: string;
}

export function ConfirmForm({
  action,
  message = "Are you sure?",
  children,
  className,
}: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm(message)) {
      e.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className={className}>
      {children}
    </form>
  );
}
