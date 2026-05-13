import PublishControl from "@/components/publish/PublishControl";

type PublishPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function PublishPage({ params }: PublishPageProps) {
  const { postId } = await params;

  return (
    <PublishControl postId={postId} />
  );
}
