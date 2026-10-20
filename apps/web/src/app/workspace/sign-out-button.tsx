import { signOutAction } from "../login/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button className="auth-secondary" type="submit">Sign out</button>
    </form>
  );
}
