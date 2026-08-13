import { CandidateLayout } from "@/components/layouts/candidate-layout";

export default function CandidateRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CandidateLayout>{children}</CandidateLayout>;
}
