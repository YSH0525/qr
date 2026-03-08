"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useBluetoothPrinter } from "@/hooks/use-bluetooth-printer";

type BluetoothPrinterContextType = ReturnType<typeof useBluetoothPrinter>;

const BluetoothPrinterContext =
  createContext<BluetoothPrinterContextType | null>(null);

export function BluetoothPrinterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const printer = useBluetoothPrinter();
  return (
    <BluetoothPrinterContext.Provider value={printer}>
      {children}
    </BluetoothPrinterContext.Provider>
  );
}

export function useBluetoothPrinterContext(): BluetoothPrinterContextType {
  const ctx = useContext(BluetoothPrinterContext);
  if (!ctx) {
    throw new Error(
      "useBluetoothPrinterContext must be used within BluetoothPrinterProvider"
    );
  }
  return ctx;
}
