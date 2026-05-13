import { redirect } from "next/navigation";

export default async function IdentitiesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const connected = (await searchParams).connected;
  const connectedPlatform = Array.isArray(connected) ? connected[0] : connected;
  redirect(
    connectedPlatform
      ? `/app/identities?connected=${encodeURIComponent(connectedPlatform)}`
      : "/app/identities",
  );
}
