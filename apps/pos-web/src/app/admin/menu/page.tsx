"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth/authstore";

type MenuCategory = {
  id: string;
  name: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
};

type MenuItemData = {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  priceCents: number;
  taxable: boolean;
  isActive: boolean;
  imageUrl?: string | null;
  imageAlt?: string | null;
  category?: MenuCategory | null;
};

type MenuFormState = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  imageUrl: string;
  imageAlt: string;
  isActive: boolean;
  taxable: boolean;
};

type CategoryFormState = {
  name: string;
  sortOrder: string;
  isActive: boolean;
};

type MenuScope = "active" | "all";
type SortOption = "default" | "name-asc" | "price-low" | "price-high";

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function normalizeCategoryKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function AdminMenuPage() {
  const token = useAuthStore((s) => s.token);

  const [items, setItems] = useState<MenuItemData[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<MenuItemData | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [scope, setScope] = useState<MenuScope>("active");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("default");

  const [form, setForm] = useState<MenuFormState>({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    imageUrl: "",
    imageAlt: "",
    isActive: true,
    taxable: true,
  });

  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    name: "",
    sortOrder: "",
    isActive: true,
  });

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  async function loadMenu() {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/menu?scope=${scope}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error("Failed to load menu");
      }

      const data = await res.json();

      let rawItems: MenuItemData[] = [];
      let rawCategories: MenuCategory[] = [];

      if (Array.isArray(data.categories)) {
        rawCategories = data.categories.map((cat: any) => ({
          id: String(cat.id),
          name: cat.name,
          slug: cat.slug,
          sortOrder: cat.sortOrder,
          isActive: cat.isActive,
        }));

        rawItems = data.categories.flatMap((cat: any) =>
          (cat.items || []).map((item: any) => ({
            ...item,
            category: {
              id: String(cat.id),
              name: cat.name,
              slug: cat.slug,
              sortOrder: cat.sortOrder,
              isActive: cat.isActive,
            },
          }))
        );
      } else if (Array.isArray(data.items)) {
        rawItems = data.items;
      } else if (Array.isArray(data.menuItems)) {
        rawItems = data.menuItems;
      } else if (Array.isArray(data)) {
        rawItems = data;
      }

      if (rawCategories.length === 0) {
        const map = new Map<string, MenuCategory>();

        for (const item of rawItems) {
          const cat = item.category;
          if (!cat?.name) continue;

          if (!map.has(cat.name)) {
            map.set(cat.name, {
              id: String(cat.id ?? normalizeCategoryKey(cat.name)),
              name: cat.name,
              slug: cat.slug,
              sortOrder: cat.sortOrder,
              isActive: cat.isActive ?? true,
            });
          }
        }

        rawCategories = Array.from(map.values()).sort((a, b) =>
          (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) || a.name.localeCompare(b.name)
        );
      }

      setCategories(rawCategories);
      setItems(rawItems);
    } catch (err) {
      console.error(err);
      setError("Unable to load menu items right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMenu();
  }, [token, scope]);

  const allCategoryNames = useMemo(() => {
    const names = new Set<string>();

    for (const category of categories) {
      if (category.name?.trim()) names.add(category.name.trim());
    }

    for (const item of items) {
      names.add(item.category?.name?.trim() || "Uncategorized");
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categories, items]);

  const filteredItems = useMemo(() => {
    let next = [...items];

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      next = next.filter((item) => {
        const categoryName = item.category?.name ?? "";
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description ?? "").toLowerCase().includes(q) ||
          categoryName.toLowerCase().includes(q)
        );
      });
    }

    if (selectedCategoryFilter !== "all") {
      next = next.filter(
        (item) => (item.category?.name ?? "Uncategorized") === selectedCategoryFilter
      );
    }

    if (sortBy === "name-asc") {
      next.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "price-low") {
      next.sort((a, b) => a.priceCents - b.priceCents);
    } else if (sortBy === "price-high") {
      next.sort((a, b) => b.priceCents - a.priceCents);
    }

    return next;
  }, [items, searchTerm, selectedCategoryFilter, sortBy]);

  const groupedItems = useMemo(() => {
    const map = new Map<string, MenuItemData[]>();

    for (const item of filteredItems) {
      const categoryName = item.category?.name ?? "Uncategorized";

      if (!map.has(categoryName)) {
        map.set(categoryName, []);
      }

      map.get(categoryName)!.push(item);
    }

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredItems]);

  function openEditModal(item: MenuItemData) {
    setIsCreateMode(false);
    setSelectedItem(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      price: (item.priceCents / 100).toFixed(2),
      categoryId: item.category?.id ?? "",
      imageUrl: item.imageUrl ?? "",
      imageAlt: item.imageAlt ?? "",
      isActive: item.isActive,
      taxable: item.taxable,
    });
  }

  function openCreateModal() {
    setIsCreateMode(true);
    setSelectedItem(null);
    setForm({
      name: "",
      description: "",
      price: "",
      categoryId: categories[0]?.id ?? "",
      imageUrl: "",
      imageAlt: "",
      isActive: true,
      taxable: true,
    });
  }

  function closeItemModal() {
    setSelectedItem(null);
    setIsCreateMode(false);
    setForm({
      name: "",
      description: "",
      price: "",
      categoryId: "",
      imageUrl: "",
      imageAlt: "",
      isActive: true,
      taxable: true,
    });
  }

  function openCategoryModal() {
    setCategoryForm({
      name: "",
      sortOrder: String(categories.length),
      isActive: true,
    });
    setIsCategoryModalOpen(true);
  }

  function closeCategoryModal() {
    setIsCategoryModalOpen(false);
    setCategoryForm({
      name: "",
      sortOrder: "",
      isActive: true,
    });
  }

  function updateForm<K extends keyof MenuFormState>(key: K, value: MenuFormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateCategoryForm<K extends keyof CategoryFormState>(
    key: K,
    value: CategoryFormState[K]
  ) {
    setCategoryForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSave() {
    if (!token) return;

    try {
      const parsedPrice = Number(form.price);

      if (!form.name.trim()) {
        alert("Please enter an item name.");
        return;
      }

      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        alert("Please enter a valid price.");
        return;
      }

      if (!form.categoryId) {
        alert("Please select a category.");
        return;
      }

      const priceCents = Math.round(parsedPrice * 100);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        priceCents,
        categoryId: form.categoryId,
        imageUrl: form.imageUrl.trim(),
        imageAlt: form.imageAlt.trim(),
        taxable: form.taxable,
        isActive: form.isActive,
      };

      const url = isCreateMode
        ? `${process.env.NEXT_PUBLIC_API_URL}/menu`
        : `${process.env.NEXT_PUBLIC_API_URL}/menu/${selectedItem?.id}`;

      const method = isCreateMode ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ||
            (isCreateMode ? "Failed to create menu item" : "Failed to update menu item")
        );
      }

      await loadMenu();
      closeItemModal();
    } catch (saveError) {
      console.error(saveError);
      alert(isCreateMode ? "Could not create item." : "Could not save changes.");
    }
  }

  async function handleSaveCategory() {
    if (!token) return;

    try {
      if (!categoryForm.name.trim()) {
        alert("Please enter a category name.");
        return;
      }

      const parsedSortOrder =
        categoryForm.sortOrder.trim() === ""
          ? categories.length
          : Number(categoryForm.sortOrder);

      if (Number.isNaN(parsedSortOrder) || parsedSortOrder < 0) {
        alert("Please enter a valid sort order.");
        return;
      }

      const payload = {
        name: categoryForm.name.trim(),
        sortOrder: parsedSortOrder,
        isActive: categoryForm.isActive,
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/menu/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create category");
      }

      await loadMenu();
      closeCategoryModal();
    } catch (saveError) {
      console.error(saveError);
      alert("Could not create category.");
    }
  }

  async function handleToggleActive(item: MenuItemData) {
    if (!token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/menu/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: item.name,
          description: item.description ?? "",
          priceCents: item.priceCents,
          categoryId: item.category?.id ?? "",
          imageUrl: item.imageUrl ?? "",
          imageAlt: item.imageAlt ?? "",
          taxable: item.taxable,
          isActive: !item.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update item status");
      }

      await loadMenu();
    } catch (toggleError) {
      console.error(toggleError);
      alert("Could not update item status.");
    }
  }

  function scrollToCategory(categoryName: string) {
    const key = normalizeCategoryKey(categoryName);
    const el = sectionRefs.current[key];

    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  const activeCount = items.filter((item) => item.isActive).length;
  const inactiveCount = items.filter((item) => !item.isActive).length;

  return (
    <div>
      <div className="adminPageHeader">
        <div>
          <div className="adminPageTitle">Menu Management</div>
          <p className="adminPageSubtitle">
            View menu items, categories, pricing, and availability.
          </p>
        </div>

        <div className="adminPageHeaderActions">
          <div className="adminFilterGroup">
            <button
              type="button"
              className={`adminFilterBtn ${scope === "active" ? "active" : ""}`}
              onClick={() => setScope("active")}
            >
              Active Only
            </button>
            <button
              type="button"
              className={`adminFilterBtn ${scope === "all" ? "active" : ""}`}
              onClick={() => setScope("all")}
            >
              All Items
            </button>
          </div>

          <button className="adminAddBtn" onClick={openCategoryModal} type="button">
            + Add Category
          </button>

          <button className="adminAddBtn" onClick={openCreateModal} type="button">
            + Add Item
          </button>
        </div>
      </div>

      {!loading && !error && items.length > 0 && (
        <>
          <div className="adminMenuToolbar">
            <div className="adminMenuSearchWrap">
              <input
                type="text"
                className="adminMenuSearchInput"
                placeholder="Search items, descriptions, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="adminMenuToolbarRight">
              <select
                className="adminMenuSelect"
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {allCategoryNames.map((categoryName) => (
                  <option key={categoryName} value={categoryName}>
                    {categoryName}
                  </option>
                ))}
              </select>

              <select
                className="adminMenuSelect"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="default">Default Sort</option>
                <option value="name-asc">Name A-Z</option>
                <option value="price-low">Price Low-High</option>
                <option value="price-high">Price High-Low</option>
              </select>
            </div>
          </div>

          <div className="adminCategoryBar">
            {groupedItems.map(([categoryName]) => (
              <button
                key={categoryName}
                type="button"
                className="adminCategoryPill"
                onClick={() => scrollToCategory(categoryName)}
              >
                {categoryName}
              </button>
            ))}
          </div>
        </>
      )}

      {loading && <p className="adminPageMutedText">Loading menu items...</p>}

      {!loading && error && (
        <div className="adminCard">
          <div className="adminCardTitle">Could not load menu</div>
          <p className="adminPageMutedText">{error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="adminCard">
          <div className="adminCardTitle">No menu items found</div>
          <p className="adminPageMutedText">
            There are no menu items to display for this filter.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="adminMetrics">
            <div className="adminMetricCard">
              <div className="adminMetricLabel">Total Items</div>
              <div className="adminMetricValue">{items.length}</div>
            </div>

            <div className="adminMetricCard">
              <div className="adminMetricLabel">Active Items</div>
              <div className="adminMetricValue">{activeCount}</div>
            </div>

            <div className="adminMetricCard">
              <div className="adminMetricLabel">Inactive Items</div>
              <div className="adminMetricValue">{inactiveCount}</div>
            </div>

            <div className="adminMetricCard">
              <div className="adminMetricLabel">Categories</div>
              <div className="adminMetricValue">{allCategoryNames.length}</div>
            </div>
          </div>

          {groupedItems.length === 0 ? (
            <div className="adminCard">
              <div className="adminCardTitle">No matching items</div>
              <p className="adminPageMutedText">
                Try a different search, category, or sort option.
              </p>
            </div>
          ) : (
            <div className="adminMenuGroups">
              {groupedItems.map(([categoryName, categoryItems]) => (
                <section
                  key={categoryName}
                  id={normalizeCategoryKey(categoryName)}
                  ref={(el) => {
                    sectionRefs.current[normalizeCategoryKey(categoryName)] = el;
                  }}
                  className="adminCard adminMenuSection"
                >
                  <div className="adminMenuSectionHeader">
                    <div>
                      <div className="adminCardTitle">{categoryName}</div>
                      <div className="adminSectionSubtext">
                        {categoryItems.length} item{categoryItems.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>

                  <div className="adminMenuGrid">
                    {categoryItems.map((item) => (
                      <div
                        key={item.id}
                        className={`adminMenuItemCard ${!item.isActive ? "isInactive" : ""}`}
                      >
                        <div className="adminMenuItemTop">
                          <div>
                            <div className="adminMenuItemName">{item.name}</div>
                            <div className="adminMenuItemMetaRow">
                              <span
                                className={
                                  item.isActive
                                    ? "adminMenuBadge adminMenuBadgeActive"
                                    : "adminMenuBadge adminMenuBadgeInactive"
                                }
                              >
                                {item.isActive ? "Active" : "Inactive"}
                              </span>

                              <span className="adminMenuMetaText">
                                {item.taxable ? "Taxable" : "Non-taxable"}
                              </span>
                            </div>
                          </div>

                          <div className="adminMenuPrice">
                            ${centsToDollars(item.priceCents)}
                          </div>
                        </div>

                        <div className="adminMenuDescription">
                          {item.description?.trim()
                            ? item.description
                            : "No description added."}
                        </div>

                        {item.imageUrl ? (
                          <div className="adminMenuImageWrap">
                            <img
                              src={item.imageUrl}
                              alt={item.imageAlt || item.name}
                              className="adminMenuImage"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        ) : null}

                        <div className="adminMenuFooter">
                          <span className="adminMenuFooterLabel">
                            Category: {item.category?.name ?? "Uncategorized"}
                          </span>

                          <div className="adminMenuActions">
                            <button
                              className={`adminMenuToggleBtn ${
                                item.isActive ? "danger" : "success"
                              }`}
                              onClick={() => handleToggleActive(item)}
                              type="button"
                            >
                              {item.isActive ? "Deactivate" : "Activate"}
                            </button>

                            <button
                              className="adminMenuEditBtn"
                              onClick={() => openEditModal(item)}
                              type="button"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {(selectedItem || isCreateMode) && (
        <div className="adminModalOverlay" onClick={closeItemModal}>
          <div className="adminModal" onClick={(e) => e.stopPropagation()}>
            <div className="adminModalHeader">
              <div>
                <h2 className="adminModalTitle">
                  {isCreateMode ? "Add New Item" : "Edit Item"}
                </h2>
                <p className="adminModalSubtitle">
                  {isCreateMode
                    ? "Create a new menu item for the restaurant menu."
                    : "Update menu item details before saving changes."}
                </p>
              </div>

              <button
                className="adminModalClose"
                onClick={closeItemModal}
                type="button"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="adminModalBody">
              <div className="adminFormGroup">
                <label htmlFor="menu-name">Name</label>
                <input
                  id="menu-name"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                />
              </div>

              <div className="adminFormGroup">
                <label htmlFor="menu-description">Description</label>
                <textarea
                  id="menu-description"
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                />
              </div>

              <div className="adminFormGroup">
                <label htmlFor="menu-price">Price ($)</label>
                <input
                  id="menu-price"
                  value={form.price}
                  onChange={(e) => updateForm("price", e.target.value)}
                />
              </div>

              <div className="adminFormGroup">
                <label htmlFor="menu-category">Category</label>
                <select
                  id="menu-category"
                  value={form.categoryId}
                  onChange={(e) => updateForm("categoryId", e.target.value)}
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="adminFormGroup">
                <label htmlFor="menu-image-url">Image URL</label>
                <input
                  id="menu-image-url"
                  value={form.imageUrl}
                  onChange={(e) => updateForm("imageUrl", e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="adminFormGroup">
                <label htmlFor="menu-image-alt">Image Alt</label>
                <input
                  id="menu-image-alt"
                  value={form.imageAlt}
                  onChange={(e) => updateForm("imageAlt", e.target.value)}
                  placeholder="Short description of the image"
                />
              </div>

              <div className="adminSwitchRow">
                <label className="adminSwitchCard">
                  <span className="adminSwitchTextBlock">
                    <span className="adminSwitchLabel">Active item</span>
                    <span className="adminSwitchHelp">
                      Control whether this item appears on the menu.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => updateForm("isActive", e.target.checked)}
                  />
                </label>

                <label className="adminSwitchCard">
                  <span className="adminSwitchTextBlock">
                    <span className="adminSwitchLabel">Taxable</span>
                    <span className="adminSwitchHelp">
                      Mark whether tax should apply to this item.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.taxable}
                    onChange={(e) => updateForm("taxable", e.target.checked)}
                  />
                </label>
              </div>
            </div>

            <div className="adminModalActions">
              <button
                className="adminModalSecondaryBtn"
                onClick={closeItemModal}
                type="button"
              >
                Cancel
              </button>

              <button
                className="adminModalPrimaryBtn"
                onClick={handleSave}
                type="button"
              >
                {isCreateMode ? "Create Item" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCategoryModalOpen && (
        <div className="adminModalOverlay" onClick={closeCategoryModal}>
          <div className="adminModal" onClick={(e) => e.stopPropagation()}>
            <div className="adminModalHeader">
              <div>
                <h2 className="adminModalTitle">Add Category</h2>
                <p className="adminModalSubtitle">
                  Create a new category for organizing menu items.
                </p>
              </div>

              <button
                className="adminModalClose"
                onClick={closeCategoryModal}
                type="button"
                aria-label="Close category modal"
              >
                ✕
              </button>
            </div>

            <div className="adminModalBody">
              <div className="adminFormGroup">
                <label htmlFor="category-name">Category name</label>
                <input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={(e) => updateCategoryForm("name", e.target.value)}
                  placeholder="Example: Appetizers"
                />
              </div>

              <div className="adminFormGroup">
                <label htmlFor="category-sort-order">Sort order</label>
                <input
                  id="category-sort-order"
                  value={categoryForm.sortOrder}
                  onChange={(e) => updateCategoryForm("sortOrder", e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="adminSwitchRow">
                <label className="adminSwitchCard">
                  <span className="adminSwitchTextBlock">
                    <span className="adminSwitchLabel">Active category</span>
                    <span className="adminSwitchHelp">
                      Active categories can be used for menu items.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={categoryForm.isActive}
                    onChange={(e) => updateCategoryForm("isActive", e.target.checked)}
                  />
                </label>
              </div>
            </div>

            <div className="adminModalActions">
              <button
                className="adminModalSecondaryBtn"
                onClick={closeCategoryModal}
                type="button"
              >
                Cancel
              </button>

              <button
                className="adminModalPrimaryBtn"
                onClick={handleSaveCategory}
                type="button"
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}