import React from "react";
import { Sparkles } from "lucide-react";

interface Step4Props {
  onBack: () => void;
}

export const Step4Results: React.FC<Step4Props> = ({ onBack }) => {
  return (
    <div className="min-h-[480px] space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-wide text-white">Chờ phân tích backend</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Analysis job chưa được tạo. Hãy quay lại chỉnh sửa hoặc xác nhận để gửi project và story lên backend.
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-700 bg-surface-dark p-6 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-orange-400" />
        <p className="mt-3 text-sm font-semibold text-slate-200">Kết quả sẽ xuất hiện sau khi job hoàn tất</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Dữ liệu kịch bản và phân tích sẽ được đồng bộ trực tiếp từ API backend.
        </p>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700/80"
      >
        Chỉnh sửa
      </button>
    </div>
  );
};
