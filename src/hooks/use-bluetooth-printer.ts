"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 일반적인 BLE 영수증 프린터 서비스/캐릭터리스틱 UUID
const PRINTER_SERVICE_UUIDS = [
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // 범용 BLE 프린터
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC (많은 중국산 프린터)
  "0000ff00-0000-1000-8000-00805f9b34fb", // 일부 프린터
  "000018f0-0000-1000-8000-00805f9b34fb", // Bluetooth SIG 프린터
];

const PRINTER_CHAR_UUIDS = [
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f", // 범용 BLE 프린터 write
  "49535343-8841-43f4-a8d4-ecbe34729bb3", // ISSC TX
  "0000ff02-0000-1000-8000-00805f9b34fb", // 일부 프린터 write
];

// BLE 전송 시 청크 크기 (MTU 제한 대응)
const CHUNK_SIZE = 100;
const CHUNK_DELAY_MS = 30;

interface BluetoothPrinterState {
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  printerName: string | null;
  error: string | null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useBluetoothPrinter() {
  const [state, setState] = useState<BluetoothPrinterState>({
    isSupported: false,
    isConnected: false,
    isConnecting: false,
    isPrinting: false,
    printerName: null,
    error: null,
  });

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(
    null
  );

  // Web Bluetooth API 지원 여부 확인
  useEffect(() => {
    setState((s) => ({
      ...s,
      isSupported: typeof navigator !== "undefined" && "bluetooth" in navigator,
    }));
  }, []);

  // 연결 끊김 감지
  const handleDisconnect = useCallback(() => {
    characteristicRef.current = null;
    setState((s) => ({
      ...s,
      isConnected: false,
      printerName: null,
      error: null,
    }));
  }, []);

  // GATT 서비스에서 write 가능한 캐릭터리스틱 탐색
  const findWriteCharacteristic = async (
    server: BluetoothRemoteGATTServer
  ): Promise<BluetoothRemoteGATTCharacteristic | null> => {
    // 1) 알려진 서비스 UUID로 시도
    for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        // 알려진 캐릭터리스틱 UUID로 시도
        for (const charUuid of PRINTER_CHAR_UUIDS) {
          try {
            const char = await service.getCharacteristic(charUuid);
            if (
              char.properties.write ||
              char.properties.writeWithoutResponse
            ) {
              return char;
            }
          } catch {
            // 이 UUID가 없으면 다음 시도
          }
        }
        // 알려진 UUID로 못 찾으면 모든 캐릭터리스틱을 순회
        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (
              char.properties.write ||
              char.properties.writeWithoutResponse
            ) {
              return char;
            }
          }
        } catch {
          // 캐릭터리스틱 열거 실패
        }
      } catch {
        // 이 서비스 UUID가 없으면 다음 시도
      }
    }

    // 2) 모든 서비스 순회 (optionalServices로 접근 가능한 것들)
    try {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (
              char.properties.write ||
              char.properties.writeWithoutResponse
            ) {
              return char;
            }
          }
        } catch {
          // 캐릭터리스틱 열거 실패
        }
      }
    } catch {
      // 서비스 열거 실패
    }

    return null;
  };

  // 프린터 연결
  const connect = useCallback(async () => {
    if (!("bluetooth" in navigator)) {
      setState((s) => ({
        ...s,
        error: "이 브라우저는 블루투스를 지원하지 않습니다.",
      }));
      return false;
    }

    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const device = await navigator.bluetooth.requestDevice({
        // 프린터 필터: 알려진 서비스 UUID 또는 모든 기기 허용
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICE_UUIDS,
      });

      if (!device.gatt) {
        throw new Error("GATT 서버를 사용할 수 없습니다.");
      }

      device.addEventListener("gattserverdisconnected", handleDisconnect);

      const server = await device.gatt.connect();
      const characteristic = await findWriteCharacteristic(server);

      if (!characteristic) {
        await server.disconnect();
        throw new Error(
          "프린터에서 쓰기 가능한 특성을 찾을 수 없습니다. 지원되는 BLE 프린터인지 확인해주세요."
        );
      }

      deviceRef.current = device;
      characteristicRef.current = characteristic;

      setState((s) => ({
        ...s,
        isConnected: true,
        isConnecting: false,
        printerName: device.name || "BLE 프린터",
        error: null,
      }));

      return true;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.includes("User cancelled")
            ? "프린터 선택이 취소되었습니다."
            : err.message
          : "프린터 연결에 실패했습니다.";

      setState((s) => ({
        ...s,
        isConnecting: false,
        error: message,
      }));
      return false;
    }
  }, [handleDisconnect]);

  // 프린터 연결 해제
  const disconnect = useCallback(() => {
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect();
    }
    deviceRef.current = null;
    characteristicRef.current = null;
    setState((s) => ({
      ...s,
      isConnected: false,
      printerName: null,
      error: null,
    }));
  }, []);

  // 데이터 전송 (청크 분할)
  const print = useCallback(async (data: Uint8Array): Promise<boolean> => {
    const char = characteristicRef.current;
    if (!char) {
      setState((s) => ({
        ...s,
        error: "프린터가 연결되어 있지 않습니다.",
      }));
      return false;
    }

    setState((s) => ({ ...s, isPrinting: true, error: null }));

    try {
      // 청크 분할 전송
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const chunk = data.slice(offset, offset + CHUNK_SIZE);
        if (char.properties.writeWithoutResponse) {
          await char.writeValueWithoutResponse(chunk);
        } else {
          await char.writeValue(chunk);
        }
        if (offset + CHUNK_SIZE < data.length) {
          await delay(CHUNK_DELAY_MS);
        }
      }

      setState((s) => ({ ...s, isPrinting: false }));
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "인쇄에 실패했습니다.";
      setState((s) => ({ ...s, isPrinting: false, error: message }));
      return false;
    }
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (deviceRef.current?.gatt?.connected) {
        deviceRef.current.removeEventListener(
          "gattserverdisconnected",
          handleDisconnect
        );
      }
    };
  }, [handleDisconnect]);

  return {
    ...state,
    connect,
    disconnect,
    print,
  };
}
