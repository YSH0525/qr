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
import { Plus, Trash2, Settings2 } from "lucide-react";
import type { ServiceCategory, ServiceItem } from "@/types/service";
import { SERVICE_TYPE_LABELS } from "@/types/service";

export default function ServiceSettingsPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // New category form
  const [newCat, setNewCat] = useState({
    name: "",
    type: "cleaning" as ServiceCategory["type"],
    icon: "Sparkles",
    description: "",
    hourlyRate: 0,
  });

  // New item form
  const [newItem, setNewItem] = useState({ name: "", icon: "package" });

  const fetchCategories = async () => {
    const res = await fetch("/api/service-categories");
    if (res.ok) setCategories(await res.json());
  };

  const fetchItems = async (categoryId: string) => {
    const res = await fetch(`/api/service-items?categoryId=${categoryId}`);
    if (res.ok) setItems(await res.json());
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCatId) fetchItems(selectedCatId);
  }, [selectedCatId]);

  const addCategory = async () => {
    const res = await fetch("/api/service-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newCat,
        displayOrder: categories.length,
        isActive: true,
      }),
    });
    if (res.ok) {
      toast.success("서비스 카테고리가 추가되었습니다");
      setCatOpen(false);
      setNewCat({ name: "", type: "cleaning", icon: "Sparkles", description: "", hourlyRate: 0 });
      fetchCategories();
    }
  };

  const toggleCategory = async (cat: ServiceCategory) => {
    await fetch(`/api/service-categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    fetchCategories();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("이 서비스를 삭제하시겠습니까?")) return;
    await fetch(`/api/service-categories/${id}`, { method: "DELETE" });
    toast.success("삭제되었습니다");
    if (selectedCatId === id) setSelectedCatId(null);
    fetchCategories();
  };

  const addItem = async () => {
    if (!selectedCatId) return;
    try {
      const res = await fetch("/api/service-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newItem,
          categoryId: selectedCatId,
          displayOrder: items.length,
          isAvailable: true,
        }),
      });
      if (res.ok) {
        toast.success("아이템이 추가되었습니다");
        setItemOpen(false);
        setNewItem({ name: "", icon: "package" });
        fetchItems(selectedCatId);
      } else {
        toast.error("아이템 등록에 실패했습니다");
      }
    } catch {
      toast.error("아이템 등록 중 오류가 발생했습니다");
    }
  };

  const toggleItem = async (item: ServiceItem) => {
    await fetch(`/api/service-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !item.isAvailable }),
    });
    if (selectedCatId) fetchItems(selectedCatId);
  };

  const deleteItem = async (id: string) => {
    await fetch(`/api/service-items/${id}`, { method: "DELETE" });
    toast.success("삭제되었습니다");
    if (selectedCatId) fetchItems(selectedCatId);
  };

  const ICON_OPTIONS = [
    { value: "Sparkles", label: "청소" },
    { value: "Clock", label: "시계" },
    { value: "Package", label: "박스" },
  ];

  const TYPE_OPTIONS = [
    { value: "cleaning", label: "청소 요청" },
    { value: "checkout_extension", label: "체크아웃 연장" },
    { value: "amenity", label: "비품 요청" },
  ];

  const selectedCat = categories.find((c) => c.id === selectedCatId);

  const ITEM_LABELS: Record<string, { button: string; title: string; dialog: string; placeholder: string }> = {
    amenity: { button: "비품 관리", title: "비품 아이템", dialog: "비품 아이템 추가", placeholder: "아이템명 (예: 수건)" },
    cleaning: { button: "옵션 관리", title: "청소 옵션", dialog: "청소 옵션 추가", placeholder: "옵션명 (예: 화장실 청소)" },
    checkout_extension: { button: "옵션 관리", title: "연장 옵션", dialog: "연장 옵션 추가", placeholder: "옵션명 (예: 1시간 연장)" },
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">서비스 설정</h1>
        <Dialog open={catOpen} onOpenChange={setCatOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              서비스 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>서비스 카테고리 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input
                placeholder="서비스명 (예: 연박 청소)"
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              />
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={newCat.type}
                onChange={(e) =>
                  setNewCat({ ...newCat, type: e.target.value as ServiceCategory["type"] })
                }
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={newCat.icon}
                onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })}
              >
                {ICON_OPTIONS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
              <Input
                placeholder="설명 (예: 객실 청소를 요청합니다)"
                value={newCat.description}
                onChange={(e) =>
                  setNewCat({ ...newCat, description: e.target.value })
                }
              />
              {newCat.type === "checkout_extension" && (
                <Input
                  type="number"
                  placeholder="시간당 요금 (원)"
                  value={newCat.hourlyRate || ""}
                  onChange={(e) =>
                    setNewCat({ ...newCat, hourlyRate: Number(e.target.value) })
                  }
                />
              )}
              <Button className="w-full" onClick={addCategory} disabled={!newCat.name}>
                추가
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>서비스 카테고리</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>서비스명</TableHead>
                <TableHead>타입</TableHead>
                <TableHead>설명</TableHead>
                <TableHead>상태</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow
                  key={cat.id}
                  className={selectedCatId === cat.id ? "bg-blue-50" : ""}
                >
                  <TableCell className="font-semibold">{cat.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {SERVICE_TYPE_LABELS[cat.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {cat.description}
                    {cat.type === "checkout_extension" && cat.hourlyRate ? (
                      <span className="ml-2 text-amber-600">
                        ({cat.hourlyRate.toLocaleString()}원/시간)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={cat.isActive ? "default" : "secondary"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory(cat);
                      }}
                    >
                      {cat.isActive ? "활성" : "비활성"}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCatId(selectedCatId === cat.id ? null : cat.id);
                        }}
                      >
                        <Settings2 className="w-4 h-4 mr-1" />
                        {ITEM_LABELS[cat.type]?.button || "관리"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCategory(cat.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    등록된 서비스가 없습니다
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Items for selected category */}
      {selectedCat && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedCat.name} — {ITEM_LABELS[selectedCat.type]?.title || "아이템"}</CardTitle>
              <Dialog open={itemOpen} onOpenChange={setItemOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    아이템 추가
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ITEM_LABELS[selectedCat.type]?.dialog || "아이템 추가"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <Input
                      placeholder={ITEM_LABELS[selectedCat.type]?.placeholder || "아이템명"}
                      value={newItem.name}
                      onChange={(e) =>
                        setNewItem({ ...newItem, name: e.target.value })
                      }
                    />
                    <Button className="w-full" onClick={addItem} disabled={!newItem.name}>
                      추가
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>아이템명</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={item.isAvailable ? "default" : "secondary"}
                        onClick={() => toggleItem(item)}
                      >
                        {item.isAvailable ? "사용" : "미사용"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-400 py-6">
                      등록된 아이템이 없습니다
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
