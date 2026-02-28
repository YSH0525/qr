"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, ImageIcon } from "lucide-react";

interface Category {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  displayOrder: number;
}

interface CategoryWithItems extends Category {
  items: MenuItem[];
}

export default function MenuPage() {
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchMenu = () => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then(setCategories);
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const formatPrice = (price: number) => price.toLocaleString("ko-KR") + "원";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">메뉴 관리</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditItem(null)}>
              <Plus className="w-4 h-4 mr-2" />
              메뉴 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editItem ? "메뉴 수정" : "새 메뉴 추가"}
              </DialogTitle>
            </DialogHeader>
            <MenuForm
              categories={categories}
              item={editItem}
              onSave={() => {
                setDialogOpen(false);
                fetchMenu();
                toast.success("저장되었습니다");
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {categories.map((category) => (
        <Card key={category.id} className="mb-6">
          <CardHeader>
            <CardTitle>{category.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {category.items.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 flex gap-4"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {!item.isAvailable && (
                        <Badge variant="destructive">품절</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatPrice(item.price)}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1"
                      onClick={() => {
                        setEditItem(item);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      수정
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MenuForm({
  categories,
  item,
  onSave,
}: {
  categories: CategoryWithItems[];
  item: MenuItem | null;
  onSave: () => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [price, setPrice] = useState(item?.price?.toString() || "");
  const [categoryId, setCategoryId] = useState(
    item?.categoryId?.toString() || categories[0]?.id?.toString() || ""
  );
  const [description, setDescription] = useState(item?.description || "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl || "");
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/menu/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setImageUrl(data.url);
        toast.success("이미지 업로드 완료");
      }
    } catch {
      toast.error("이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = {
      name,
      price: parseInt(price),
      categoryId,
      description: description || undefined,
      imageUrl: imageUrl || undefined,
      isAvailable,
    };

    const url = item ? `/api/menu/${item.id}` : "/api/menu";
    const method = item ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onSave();
    } else {
      toast.error("저장에 실패했습니다");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">카테고리</label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">메뉴명</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="text-sm font-medium">가격 (원)</label>
        <Input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">설명 (선택)</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium">이미지</label>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploading}
          />
          {imageUrl && (
            <img
              src={imageUrl}
              alt="미리보기"
              className="w-12 h-12 object-cover rounded"
            />
          )}
        </div>
        {uploading && (
          <p className="text-xs text-gray-400 mt-1">업로드 중...</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
          id="available"
        />
        <label htmlFor="available" className="text-sm">
          판매 가능
        </label>
      </div>
      <Button type="submit" className="w-full">
        {item ? "수정" : "추가"}
      </Button>
    </form>
  );
}
