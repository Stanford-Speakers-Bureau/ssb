import CampaignEditorClient from "./CampaignEditorClient";

export const dynamic = "force-dynamic";

export default async function CampaignEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CampaignEditorClient campaignId={id} />;
}
