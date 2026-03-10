export default function RefundPolicyPage() {
  return (
    <div className="max-w-lg mx-auto px-5 py-8">
      <h1 className="text-xl font-bold mb-6">환불/취소 규정</h1>

      <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="font-semibold text-base mb-2">1. 주문 취소</h2>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span>주문 접수 전 (준비 전)</span>
              <span className="font-semibold text-green-600">전액 환불</span>
            </div>
            <div className="flex justify-between">
              <span>주문 접수 후 (준비 중)</span>
              <span className="font-semibold text-red-500">환불 불가</span>
            </div>
            <div className="flex justify-between">
              <span>서비스 제공 완료 후</span>
              <span className="font-semibold text-red-500">환불 불가</span>
            </div>
          </div>
          <p className="mt-2 text-gray-500">
            음식 및 음료는 위생상의 이유로 준비가 시작된 후에는 취소 및 환불이 불가합니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">2. 카카오페이 결제 취소</h2>
          <p>
            카카오페이로 결제한 주문의 취소는 프런트 데스크에 직접 요청해 주시기 바랍니다.
            환불 가능한 경우, 결제 수단으로 환불이 진행되며 카카오페이 환불은 영업일 기준
            3~5일 소요될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">3. 후불결제 취소</h2>
          <p>
            후불결제 주문은 서비스 준비 전까지 취소가 가능합니다.
            퇴실 시 프런트 데스크에서 최종 정산 내역을 확인하실 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">4. 서비스 불만족 시</h2>
          <p>
            제공된 서비스에 문제가 있는 경우 (상품 하자, 오배송 등),
            프런트 데스크(내선 0번)로 즉시 연락해 주시면 교환 또는 환불 조치를 해드립니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">5. 체크아웃 연장 서비스</h2>
          <p>
            체크아웃 연장 서비스는 결제 완료 후 취소가 불가합니다.
            다만, 호텔 사정으로 연장이 불가능한 경우 전액 환불됩니다.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">6. 환불 처리 기간</h2>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span>카카오페이</span>
              <span>취소 후 3~5 영업일</span>
            </div>
            <div className="flex justify-between">
              <span>후불결제</span>
              <span>퇴실 시 정산에서 제외</span>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">7. 문의</h2>
          <p>
            환불 및 취소 관련 문의는 프런트 데스크 또는 아래 연락처로 문의해 주시기 바랍니다.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mt-2">
            <p>전화: 051-751-0134</p>
            <p>프런트 데스크: 객실 전화 내선 0번</p>
          </div>
        </section>

        <section className="text-gray-400 text-xs pt-4 border-t">
          <p>시행일: 2025년 1월 1일</p>
          <p className="mt-1">더반스테이 | 대표: 윤상호</p>
          <p>부산광역시 수영구 수영로 562-14(광안동)</p>
        </section>
      </div>
    </div>
  );
}
