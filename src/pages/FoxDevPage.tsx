import { useNavigate } from "react-router-dom";
import FoxDevModal from "@/components/FoxDevModal";

const FoxDevPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <FoxDevModal open={true} onClose={() => navigate(-1)} />
    </div>
  );
};

export default FoxDevPage;
