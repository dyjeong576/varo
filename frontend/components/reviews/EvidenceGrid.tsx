interface EvidenceGridProps {
  distribution: {
    official: number;
    press: number;
    social: number;
  };
  consensusLevel: 'High' | 'Medium' | 'Low';
  consensusLabel: string;
}

/**
 * 출처 분포 및 정보 합의성 Bento Grid 컴포넌트
 */
export default function EvidenceGrid({ distribution, consensusLevel, consensusLabel }: EvidenceGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 출처 분포 카드 */}
      <div className="bg-white p-5 rounded-xl border border-[#c2c6d8]/15 flex flex-col justify-between h-40 shadow-sm">
        <p className="text-xs font-bold text-[#424656] mb-2">출처 분포</p>
        <div className="flex items-end gap-2 h-16 mb-2">
          <div 
            className="flex-1 bg-[#0050cb] rounded-t-sm" 
            style={{ height: `${distribution.official}%` }}
          ></div>
          <div 
            className="flex-1 bg-[#d6e3fb] rounded-t-sm" 
            style={{ height: `${distribution.press}%` }}
          ></div>
          <div 
            className="flex-1 bg-[#c2c6d8] rounded-t-sm" 
            style={{ height: `${distribution.social}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-[10px] text-[#424656] font-medium">
          <span>공식</span>
          <span>언론</span>
          <span>소셜</span>
        </div>
      </div>

      {/* 정보 합의성 카드 */}
      <div className="bg-white p-5 rounded-xl border border-[#c2c6d8]/15 flex flex-col justify-between h-40 shadow-sm">
        <p className="text-xs font-bold text-[#424656] mb-2">정보 합의성</p>
        <div className="flex flex-col items-center justify-center flex-1">
          <span className={`text-3xl font-black ${
            consensusLevel === 'High' ? 'text-[#0050cb]' : 
            consensusLevel === 'Medium' ? 'text-[#a33200]' : 'text-[#ba1a1a]'
          }`}>
            {consensusLevel === 'High' ? '높음' : consensusLevel === 'Medium' ? '보통' : '낮음'}
          </span>
          <span className="text-[10px] text-[#424656] mt-1 text-center">{consensusLabel}</span>
        </div>
      </div>
    </div>
  );
}
