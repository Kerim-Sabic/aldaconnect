import ConfirmEmail from "@/components/confirm-email";
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <ConfirmEmail
      tokenHash={typeof params.token_hash === "string" ? params.token_hash : ""}
      type={typeof params.type === "string" ? params.type : ""}
    />
  );
}
