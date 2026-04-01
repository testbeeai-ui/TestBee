import { FEATURE_TABLE_ROWS } from "./landing-constants";

export default function FeatureTableSection() {
  return (
    <section className="bg-gray-50 px-5 md:px-10 py-10 border-b border-gray-200/60">
      <div className="max-w-[1200px] mx-auto">
        <p className="text-xs font-medium tracking-[0.06em] text-gray-400 uppercase mb-[6px]">
          The EduBlast difference
        </p>
        <h2 className="text-xl md:text-[26px] font-medium text-gray-900 leading-[1.3] mb-7">
          Every feature is engineered for one thing: making you better faster.
        </h2>

        <div className="overflow-x-auto -mx-5 md:mx-0">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-gray-100 font-medium text-xs text-gray-500 p-2 md:p-[8px_12px] text-left w-[18%]">
                  Feature
                </th>
                <th className="bg-gray-100 font-medium text-xs text-gray-500 p-2 md:p-[8px_12px] text-left w-[26%]">
                  Typical EdTech
                </th>
                <th className="bg-[#E1F5EE] font-medium text-xs text-[#085041] p-2 md:p-[8px_12px] text-left w-[26%]">
                  EduBlast
                </th>
                <th className="bg-gray-100 font-medium text-xs text-gray-500 p-2 md:p-[8px_12px] text-left w-[30%]">
                  Why it matters for exams
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_TABLE_ROWS.map((row, i) => (
                <tr key={i} className="border-b border-gray-200/60 last:border-b-0">
                  <td className="p-2 md:p-[9px_12px] font-medium text-gray-900 align-top">
                    {row.feature}
                  </td>
                  <td className="p-2 md:p-[9px_12px] text-gray-500 align-top">
                    {row.typical}
                  </td>
                  <td className="p-2 md:p-[9px_12px] text-[#085041] bg-[#E1F5EE] font-medium align-top">
                    {row.ours}
                  </td>
                  <td className="p-2 md:p-[9px_12px] text-gray-500 align-top">
                    {row.why}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
