"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

// Simulated payment for the demo — no real gateway. Always succeeds after a
// short delay so the flow reads like a real checkout without processing money.
export function DummyPaymentButton({ price, onPaid }: { price: number; onPaid: () => void }) {
  const [processing, setProcessing] = useState(false);

  function handlePay() {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onPaid();
    }, 900);
  }

  return (
    <Button className="w-full" isLoading={processing} onClick={handlePay}>
      Pay ₹{price}
    </Button>
  );
}
