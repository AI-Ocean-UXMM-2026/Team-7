"use client";

import { useEffect, useRef, useState } from "react";
import { expenseCategories, expenseInputSchema, type Expense, type ExpenseInput } from "@ocean/contracts";

export function ExpenseForm({ expense, today, source, save, close }: { expense: Expense | null; today: string; source: "sample" | "live"; save: (input: ExpenseInput, id?: string) => Promise<void>; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({ description: expense?.description ?? "", category: expense?.category ?? "Packaging", amount_mmk: expense ? String(expense.amount_mmk) : "", expense_date: expense?.expense_date ?? today, notes: expense?.notes ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current; element?.showModal();
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = oldOverflow; trigger?.focus(); };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const dismiss = () => { if (pending) return; if (dirty) setDiscard(true); else close(); };
  const messages: Record<string, string> = { description: "Enter a description from 1 to 200 characters.", category: "Choose an expense category.", amount_mmk: "Enter a positive whole MMK amount within the safe integer range.", expense_date: "Choose a valid expense date.", notes: "Keep notes within 2,000 characters." };
  const parse = (only?: string) => {
    const result = expenseInputSchema.safeParse({ ...form, notes: form.notes.trim() || null, amount_mmk: form.amount_mmk.trim() ? Number(form.amount_mmk) : NaN });
    const next: Record<string, string> = {};
    if (!result.success) for (const issue of result.error.issues) {
      const key = String(issue.path[0]); if (!only || only === key) next[key] = messages[key] ?? issue.message;
    }
    if (only) setErrors(previous => { const updated = { ...previous }; delete updated[only]; return { ...updated, ...next }; });
    else setErrors(next);
    return result;
  };
  return <dialog className="order-drawer expense-drawer" ref={dialog} aria-labelledby="expense-form-title" onCancel={event => { event.preventDefault(); dismiss(); }}>
    <div className="drawer-header"><div><p className="eyebrow">{source === "sample" ? "SAMPLE EXPENSE · THIS TAB ONLY" : "YOUR SHOP · MMK"}</p><h2 id="expense-form-title">{expense ? "Edit expense" : "Add expense"}</h2></div><button className="auth-secondary" type="button" disabled={pending} onClick={dismiss}>Close</button></div>
    {discard && <div className="order-discard" role="alert"><p>Discard unsaved expense changes?</p><button className="auth-secondary" onClick={close}>Discard changes</button><button className="auth-secondary" onClick={() => setDiscard(false)}>Keep editing</button></div>}
    <form noValidate onSubmit={async event => {
      event.preventDefault(); const result = parse();
      if (!result.success) { requestAnimationFrame(() => summary.current?.focus()); return; }
      setPending(true); setFailure("");
      try { await save(result.data, expense?.id); setDirty(false); close(); }
      catch (error) { setFailure(error instanceof Error ? error.message : "Expense could not be saved. Retry after reloading."); requestAnimationFrame(() => summary.current?.focus()); }
      finally { setPending(false); }
    }}>
      <div className="drawer-content">
        {(failure || Object.keys(errors).length > 0) && <div className="order-error-summary" role="alert" tabIndex={-1} ref={summary}><h3>Check your expense</h3>{failure && <p>{failure}</p>}<ul>{Object.entries(errors).map(([key, message]) => <li key={key}><a href={`#expense-${key}`}>{message}</a></li>)}</ul></div>}
        <fieldset disabled={pending}><legend>Expense details</legend>
          {([['description', 'Description'], ['category', 'Category'], ['amount_mmk', 'Amount (MMK)'], ['expense_date', 'Date'], ['notes', 'Notes (optional)']] as const).map(([key, title]) => {
            const props = { id: `expense-${key}`, value: form[key], "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `expense-error-${key}` : undefined, onBlur: () => parse(key), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setForm({ ...form, [key]: event.target.value }); setDirty(true); } };
            return <label className="order-field" key={key} htmlFor={props.id}>{title}{key !== "notes" ? " *" : ""}{key === "category" ? <select {...props}>{!expenseCategories.some(category => category === form.category) && <option value={form.category}>{form.category} (choose a category)</option>}{expenseCategories.map(category => <option key={category}>{category}</option>)}</select> : key === "notes" ? <textarea {...props} maxLength={2000} rows={3}/> : <input {...props} required type={key === "amount_mmk" ? "number" : key === "expense_date" ? "date" : "text"} min={key === "amount_mmk" ? 1 : undefined} step={key === "amount_mmk" ? 1 : undefined} maxLength={key === "description" ? 200 : undefined}/>}{errors[key] && <span className="order-field-error" id={`expense-error-${key}`}>{errors[key]}</span>}</label>;
          })}
          <p className="settings-note">Product costs records inventory purchases. They are shown as spending, and are not subtracted again from profit when order product costs are already included.</p>
        </fieldset>
      </div><div className="drawer-footer"><button className="auth-secondary" type="button" onClick={dismiss} disabled={pending}>Cancel</button><button className="auth-submit" disabled={pending}>{pending ? "Saving…" : source === "sample" ? "Save sample expense" : "Save expense"}</button></div>
    </form>
  </dialog>;
}
