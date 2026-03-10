import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="max-w-lg mx-auto px-5 py-8">
      <h1 className="text-xl font-bold mb-6">이용약관</h1>

      <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="font-semibold text-base mb-2">제1조 (목적)</h2>
          <p>
            본 약관은 더반스테이(이하 &quot;호텔&quot;)가 운영하는 객실 서비스 주문 시스템(이하 &quot;서비스&quot;)의
            이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">제2조 (서비스의 내용)</h2>
          <p>호텔은 투숙객에게 다음의 객실 서비스를 제공합니다.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>객실 내 음식 및 음료 주문</li>
            <li>객실 청소 서비스 요청</li>
            <li>비품(수건, 어메니티 등) 추가 요청</li>
            <li>체크아웃 연장 서비스</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">제3조 (이용자)</h2>
          <p>
            본 서비스는 호텔에 투숙 중인 고객(이하 &quot;이용자&quot;)만 이용할 수 있으며,
            객실에 비치된 QR코드를 통해 접근합니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">제4조 (결제 방법)</h2>
          <p>서비스 이용 시 다음의 결제 방법을 제공합니다.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>카카오페이 결제:</strong> 주문 시 즉시 결제가 이루어집니다.</li>
            <li><strong>후불결제:</strong> 퇴실(체크아웃) 시 프런트에서 일괄 정산합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">제5조 (서비스 제공 시간)</h2>
          <p>
            음식 및 음료 주문은 주문 접수 후 약 15~30분 내에 객실로 제공됩니다.
            청소 및 비품 요청은 접수 순서에 따라 순차적으로 처리됩니다.
            서비스 제공 시간은 호텔 운영 상황에 따라 변동될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">제6조 (취소 및 환불)</h2>
          <p>
            취소 및 환불에 관한 자세한 사항은{" "}
            <Link href="/refund-policy" className="text-blue-600 underline">
              환불/취소 규정
            </Link>
            을 참조해 주시기 바랍니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">제7조 (개인정보 수집)</h2>
          <p>
            호텔은 서비스 제공을 위해 최소한의 정보(객실 번호, 주문 내역)만을 수집하며,
            서비스 목적 외의 용도로 사용하지 않습니다. 결제 정보는 카카오페이를 통해
            안전하게 처리되며, 호텔은 결제 정보를 직접 저장하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">제8조 (면책)</h2>
          <p>
            호텔은 천재지변, 시스템 장애 등 불가항력적 사유로 인한 서비스 중단에 대해
            책임을 지지 않습니다. 다만, 이러한 경우 결제된 금액은 전액 환불합니다.
          </p>
        </section>

        <section className="text-gray-400 text-xs pt-4 border-t">
          <p>시행일: 2025년 1월 1일</p>
          <p className="mt-1">더반스테이 | 대표: 윤상호</p>
          <p>부산광역시 수영구 수영로 562-14(광안동)</p>
          <p>전화: 051-751-0134</p>
        </section>
      </div>
    </div>
  );
}
