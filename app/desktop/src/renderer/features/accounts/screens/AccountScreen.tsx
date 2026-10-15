import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { FeaturePage } from "../../workspace/components/FeaturePage";
import { applicationReturnPath } from "../account-navigation";
import { AnalysisAccounts } from "../components/AnalysisAccounts";

export function AccountScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = applicationReturnPath(location.search);
  const returnLabel = returnTo.startsWith("/projects/")
    ? "Return to workspace"
    : returnTo.startsWith("/settings")
      ? "Back to Settings"
      : "Back to Projects";

  return (
    <FeaturePage
      eyebrow="Application"
      title="Account"
      description="Manage the AI connection used for chapter analysis."
      actions={
        <Button variant="outline" size="default" onClick={() => navigate(returnTo, { replace: true })}>
          <ArrowLeft size={14} /> {returnLabel}
        </Button>
      }
    >
      <AnalysisAccounts />
    </FeaturePage>
  );
}
