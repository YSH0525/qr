import Link from "next/link";

export function GuestFooter() {
  return (
    <footer className="bg-gray-100 border-t mt-4">
      <div className="max-w-lg mx-auto px-5 py-4 text-xs text-gray-500 space-y-2">
        <div className="space-y-1">
          <p className="font-semibold text-gray-700">더반스테이</p>
          <p>대표자: 윤상호 | 사업자등록번호: 617-36-90065</p>
          <p>부산광역시 수영구 수영로 562-14(광안동)</p>
          <p>전화: 051-751-0134</p>
        </div>
        <div className="flex gap-3 pt-2 border-t border-gray-200">
          <Link href="/terms" className="underline hover:text-gray-700">
            이용약관 Terms
          </Link>
          <Link href="/refund-policy" className="underline hover:text-gray-700">
            환불/취소 규정 Refund Policy
          </Link>
        </div>
        <p className="text-gray-400">&copy; {new Date().getFullYear()} 더반스테이. All rights reserved.</p>
      </div>
    </footer>
  );
}
