"use client";

import { useState, useEffect } from "react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
import {
  Plus,
  Pencil,
  ImageIcon,
  Trash2,
  FolderPlus,
  Settings,
} from "lucide-react";

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
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatOrder, setNewCatOrder] = useState("0");
  const [deleteCatConfirm, setDeleteCatConfirm] = useState<Category | null>(
    null
  );
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<MenuItem | null>(
    null
  );

  const fetchMenu = () => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then(setCategories);
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const formatPrice = (price: number) => price.toLocaleString("ko-KR") + "원";

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/menu/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCatName,
        displayOrder: parseInt(newCatOrder) || 0,
      }),
    });
    if (res.ok) {
      setNewCatName("");
      setNewCatOrder("0");
      setCatDialogOpen(false);
      fetchMenu();
      toast.success("카테고리가 추가되었습니다");
    } else {
      const data = await res.json();
      toast.error(data.error || "카테고리 추가 실패");
    }
  };

  const updateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategory) return;

    const res = await fetch(`/api/menu/categories/${editCategory.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCatName,
        displayOrder: parseInt(newCatOrder) || 0,
      }),
    });
    if (res.ok) {
      setEditCategory(null);
      setNewCatName("");
      setNewCatOrder("0");
      setCatDialogOpen(false);
      fetchMenu();
      toast.success("카테고리가 수정되었습니다");
    } else {
      const data = await res.json();
      toast.error(data.error || "카테고리 수정 실패");
    }
  };

  const deleteCategory = async (cat: Category) => {
    const res = await fetch(`/api/menu/categories/${cat.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDeleteCatConfirm(null);
      fetchMenu();
      toast.success(`"${cat.name}" 카테고리가 삭제되었습니다`);
    } else {
      const data = await res.json();
      toast.error(data.error || "카테고리 삭제 실패");
    }
  };

  const deleteMenuItem = async (item: MenuItem) => {
    const res = await fetch(`/api/menu/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteItemConfirm(null);
      fetchMenu();
      toast.success(`"${item.name}" 메뉴가 삭제되었습니다`);
    } else {
      const data = await res.json();
      toast.error(data.error || "메뉴 삭제 실패");
    }
  };

  const openEditCategory = (cat: Category) => {
    setEditCategory(cat);
    setNewCatName(cat.name);
    setNewCatOrder(cat.displayOrder.toString());
    setCatDialogOpen(true);
  };

  const openAddCategory = () => {
    setEditCategory(null);
    setNewCatName("");
    setNewCatOrder("0");
    setCatDialogOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">메뉴 관리</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatManagerOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            카테고리 관리
          </Button>
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
                key={editItem?.id || "new"}
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
      </div>

      {categories.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <FolderPlus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">카테고리가 없습니다</p>
            <p className="text-sm mb-4">
              먼저 카테고리를 추가한 후 메뉴를 등록하세요.
            </p>
            <Button onClick={openAddCategory}>
              <Plus className="w-4 h-4 mr-2" />
              카테고리 추가
            </Button>
          </CardContent>
        </Card>
      )}

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
                    <div className="flex gap-1 mt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditItem(item);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        수정
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => setDeleteItemConfirm(item)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {category.items.length === 0 && (
                <p className="text-sm text-gray-400 col-span-full">
                  등록된 메뉴가 없습니다.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Category Manager Dialog */}
      <Dialog open={catManagerOpen} onOpenChange={setCatManagerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>카테고리 관리</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    순서: {cat.displayOrder}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    ({cat.items.length}개 메뉴)
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCatManagerOpen(false);
                      openEditCategory(cat);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => {
                      setCatManagerOpen(false);
                      setDeleteCatConfirm(cat);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                등록된 카테고리가 없습니다.
              </p>
            )}
          </div>
          <Button
            className="w-full"
            onClick={() => {
              setCatManagerOpen(false);
              openAddCategory();
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            카테고리 추가
          </Button>
        </DialogContent>
      </Dialog>

      {/* Category Add/Edit Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editCategory ? "카테고리 수정" : "새 카테고리 추가"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editCategory ? updateCategory : addCategory}
            className="space-y-4"
          >
            <div>
              <label className="text-sm font-medium">카테고리 이름</label>
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="예: 음료, 식사, 간식"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">표시 순서</label>
              <Input
                type="number"
                value={newCatOrder}
                onChange={(e) => setNewCatOrder(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">
                숫자가 작을수록 먼저 표시됩니다.
              </p>
            </div>
            <Button type="submit" className="w-full">
              {editCategory ? "수정" : "추가"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Delete Confirmation */}
      <Dialog
        open={!!deleteCatConfirm}
        onOpenChange={() => setDeleteCatConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>카테고리 삭제 확인</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>&quot;{deleteCatConfirm?.name}&quot;</strong> 카테고리를 정말
            삭제하시겠습니까?
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteCatConfirm(null)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteCatConfirm && deleteCategory(deleteCatConfirm)
              }
            >
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Menu Item Delete Confirmation */}
      <Dialog
        open={!!deleteItemConfirm}
        onOpenChange={() => setDeleteItemConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>메뉴 삭제 확인</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>&quot;{deleteItemConfirm?.name}&quot;</strong> 메뉴를 정말
            삭제하시겠습니까? 삭제된 메뉴는 복구할 수 없습니다.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteItemConfirm(null)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteItemConfirm && deleteMenuItem(deleteItemConfirm)
              }
            >
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `menu-images/${Date.now()}.${ext}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      setImageUrl(url);
      toast.success("이미지 업로드 완료");
    } catch {
      toast.error("이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) {
      toast.error("카테고리를 선택해주세요");
      return;
    }

    const body = {
      name,
      price: parseInt(price),
      categoryId,
      description: description || null,
      imageUrl: imageUrl || null,
      isAvailable,
    };

    const url = item ? `/api/menu/${item.id}` : "/api/menu";
    const method = item ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSave();
      } else {
        const data = await res.json();
        toast.error(data.error || "저장에 실패했습니다");
      }
    } catch (err) {
      toast.error(`요청 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">카테고리</label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="카테고리를 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categories.length === 0 && (
          <p className="text-xs text-red-500 mt-1">
            먼저 카테고리를 추가해주세요.
          </p>
        )}
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
      <Button type="submit" className="w-full" disabled={categories.length === 0 || uploading}>
        {uploading ? "이미지 업로드 중..." : item ? "수정" : "추가"}
      </Button>
    </form>
  );
}
