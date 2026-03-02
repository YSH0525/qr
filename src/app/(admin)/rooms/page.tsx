"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, QrCode, Printer, Trash2, Power } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";

interface Room {
  id: string;
  roomNumber: string;
  roomId: string;
  floor: string | null;
  isActive: boolean;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoom, setNewRoom] = useState({ roomNumber: "", floor: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrRoom, setQrRoom] = useState<Room | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Room | null>(null);

  const fetchRooms = () => {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then(setRooms);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const addRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRoom),
    });
    if (res.ok) {
      setNewRoom({ roomNumber: "", floor: "" });
      setDialogOpen(false);
      fetchRooms();
      toast.success("객실이 추가되었습니다");
    } else {
      const data = await res.json();
      toast.error(data.error || "객실 추가 실패");
    }
  };

  const toggleRoom = async (room: Room) => {
    const res = await fetch(`/api/rooms/${room.roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !room.isActive }),
    });
    if (res.ok) {
      fetchRooms();
      toast.success(
        room.isActive ? "객실이 비활성화되었습니다" : "객실이 활성화되었습니다"
      );
    } else {
      const data = await res.json();
      toast.error(data.error || "상태 변경 실패");
    }
  };

  const deleteRoom = async (room: Room) => {
    const res = await fetch(`/api/rooms/${room.roomId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDeleteConfirm(null);
      fetchRooms();
      toast.success(`${room.roomNumber}호가 삭제되었습니다`);
    } else {
      const data = await res.json();
      toast.error(data.error || "삭제 실패");
    }
  };

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h1 className="text-2xl font-bold">객실 관리</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              객실 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 객실 추가</DialogTitle>
            </DialogHeader>
            <form onSubmit={addRoom} className="space-y-4">
              <div>
                <label className="text-sm font-medium">객실 번호</label>
                <Input
                  value={newRoom.roomNumber}
                  onChange={(e) =>
                    setNewRoom({ ...newRoom, roomNumber: e.target.value })
                  }
                  placeholder="예: 401"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">층</label>
                <Input
                  value={newRoom.floor}
                  onChange={(e) =>
                    setNewRoom({ ...newRoom, floor: e.target.value })
                  }
                  placeholder="예: 4층"
                />
              </div>
              <Button type="submit" className="w-full">
                추가
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>객실 목록</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>객실번호</TableHead>
                <TableHead>층</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>QR 코드</TableHead>
                <TableHead>안내문</TableHead>
                <TableHead>관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-semibold">
                    {room.roomNumber}호
                  </TableCell>
                  <TableCell>{room.floor || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={room.isActive ? "default" : "secondary"}
                    >
                      {room.isActive ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setQrRoom(room)}
                    >
                      <QrCode className="w-4 h-4 mr-1" />
                      QR 보기
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Link href={`/rooms/${room.roomId}/guide`}>
                      <Button size="sm" variant="outline">
                        <Printer className="w-4 h-4 mr-1" />
                        안내문
                      </Button>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleRoom(room)}
                        title={room.isActive ? "비활성화" : "활성화"}
                      >
                        <Power className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteConfirm(room)}
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QR Preview Dialog */}
      <Dialog open={!!qrRoom} onOpenChange={() => setQrRoom(null)}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle>{qrRoom?.roomNumber}호 QR 코드</DialogTitle>
          </DialogHeader>
          {qrRoom && (
            <div className="flex flex-col items-center gap-4 py-4">
              <QRCodeSVG
                value={`${baseUrl}/room/${qrRoom.roomId}`}
                size={256}
                level="H"
              />
              <p className="text-sm text-gray-500 break-all">
                {baseUrl}/room/{qrRoom.roomId}
              </p>
              <Button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = `/api/qr/${qrRoom.roomId}`;
                  link.download = `qr-${qrRoom.roomNumber}.png`;
                  link.click();
                }}
              >
                QR 이미지 다운로드
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>객실 삭제 확인</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>{deleteConfirm?.roomNumber}호</strong>를 정말
            삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteRoom(deleteConfirm)}
            >
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
