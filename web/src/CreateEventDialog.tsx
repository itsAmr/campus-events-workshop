import { FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, createEvent, errorMessage } from "./api";

// noValidate is deliberate: the API owns validation, and its 400 field errors
// are shown next to each input.
export function CreateEventDialog({
  categories,
  onCreated,
  onClose,
}: {
  categories: string[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.querySelector<HTMLInputElement>("input[name=title]")?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const isoDate = (name: string) =>
      text(name) ? new Date(text(name)).toISOString() : undefined;

    setSaving(true);
    setError(undefined);
    setFields({});
    try {
      await createEvent({
        title: text("title"),
        description: text("description"),
        category: text("category"),
        location: text("location"),
        startsAt: isoDate("startsAt"),
        endsAt: isoDate("endsAt"),
        capacity: Number(text("capacity")),
      });
      onCreated();
      dialogRef.current?.close();
    } catch (reason) {
      setError(errorMessage(reason));
      if (reason instanceof ApiError) setFields(reason.fields);
    } finally {
      setSaving(false);
    }
  }

  const input = (name: string) => ({
    name,
    "aria-invalid": fields[name] ? true : undefined,
  });
  const hint = (name: string) => fields[name] && <small>{fields[name][0]}</small>;

  return (
    <dialog ref={dialogRef} onClose={onClose}>
      <article>
        <header>
          <button aria-label="Close" rel="prev" onClick={() => dialogRef.current?.close()} />
          <h3>Create an event</h3>
        </header>
        <form id="create-event" onSubmit={submit} noValidate>
          <label>
            Title
            <input {...input("title")} />
            {hint("title")}
          </label>
          <div className="grid">
            <label>
              Category
              <select {...input("category")}>
                {categories.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              {hint("category")}
            </label>
            <label>
              Capacity
              <input {...input("capacity")} type="number" min="1" defaultValue="30" />
              {hint("capacity")}
            </label>
          </div>
          <label>
            Location
            <input {...input("location")} />
            {hint("location")}
          </label>
          <div className="grid">
            <label>
              Starts
              <input {...input("startsAt")} type="datetime-local" />
              {hint("startsAt")}
            </label>
            <label>
              Ends
              <input {...input("endsAt")} type="datetime-local" />
              {hint("endsAt")}
            </label>
          </div>
          <label>
            Description
            <textarea {...input("description")} rows={3} />
            {hint("description")}
          </label>
          {error && <p className="error" role="alert">{error}</p>}
        </form>
        <footer>
          <button className="secondary" onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="submit" form="create-event" aria-busy={saving} disabled={saving}>
            Create event
          </button>
        </footer>
      </article>
    </dialog>
  );
}
