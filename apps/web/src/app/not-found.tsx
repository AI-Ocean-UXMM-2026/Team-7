import Link from "next/link";
import { Placeholder } from "@ocean/ui";

export default function NotFound() {
  return (
    <div className="page-stack">
      <h1>Page not found</h1>
      <Placeholder title="Let’s get you back to shore">
        This page isn’t part of the workspace.{" "}
        <Link className="text-link" href="/">
          Return to Dashboard
        </Link>
        .
      </Placeholder>
    </div>
  );
}
