interface InfoTooltipProps {
  content: string;
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <span className="group relative inline-flex items-center">
      <span className="material-symbols-outlined cursor-help select-none !text-[14px] text-[#9ca3af] transition-colors group-hover:text-[#0050cb]">
        help
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2.5 w-60 -translate-x-1/2 rounded-xl bg-[#1e2330] px-3.5 py-2.5 text-xs leading-[1.6] text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100"
      >
        {content}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-[#1e2330]" />
      </span>
    </span>
  );
}
