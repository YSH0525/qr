const KAKAOPAY_BASE_URL = "https://open-api.kakaopay.com/online/v1/payment";

function getHeaders() {
  return {
    Authorization: `SECRET_KEY ${process.env.KAKAOPAY_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function kakaoPayReady(params: {
  orderId: string;
  itemName: string;
  totalAmount: number;
  roomId: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const cid = process.env.KAKAOPAY_CID || "TC0ONETIME";

  const response = await fetch(`${KAKAOPAY_BASE_URL}/ready`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      cid,
      partner_order_id: params.orderId,
      partner_user_id: `room_${params.roomId}`,
      item_name: params.itemName,
      quantity: 1,
      total_amount: params.totalAmount,
      tax_free_amount: 0,
      approval_url: `${baseUrl}/api/payments/kakaopay/approve?orderId=${params.orderId}`,
      cancel_url: `${baseUrl}/api/payments/kakaopay/cancel?orderId=${params.orderId}`,
      fail_url: `${baseUrl}/api/payments/kakaopay/fail?orderId=${params.orderId}`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`카카오페이 결제 준비 실패: ${error}`);
  }

  return response.json() as Promise<{
    tid: string;
    next_redirect_app_url: string;
    next_redirect_mobile_url: string;
    next_redirect_pc_url: string;
    created_at: string;
  }>;
}

export async function kakaoPayApprove(params: {
  tid: string;
  orderId: string;
  roomId: string;
  pgToken: string;
}) {
  const cid = process.env.KAKAOPAY_CID || "TC0ONETIME";

  const response = await fetch(`${KAKAOPAY_BASE_URL}/approve`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      cid,
      tid: params.tid,
      partner_order_id: params.orderId,
      partner_user_id: `room_${params.roomId}`,
      pg_token: params.pgToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`카카오페이 결제 승인 실패: ${error}`);
  }

  return response.json();
}
