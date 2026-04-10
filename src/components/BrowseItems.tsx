"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ItemCard from "@/components/ItemCard";
import { SkeletonGrid } from "@/components/SkeletonCard";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { CATEGORIES } from "@/lib/utils";

type Item = {
  id: number;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  name: string;
  description: string;
  price: number | string;
  daily_rate?: number;
  condition?: string;
  category_id?: string;
  status: "available" | "unavailable";
  item_status?: string;
  photo_url?: string;
  created_at: string;
};

/** Debounce a value by `delay` ms. */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function BrowsePage() {
  const { user, loading } = useAuth();

  const [items, setItems] = useState<Item[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Read ?q= param from URL once on mount (window.location is safe here — client component)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q")?.trim() ?? "";
      setSearchInput(q);
    }
  }, []);

  // Debounce the raw input so we don't filter on every keystroke
  const searchText = useDebounce(searchInput, 200);

  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);

    let query = supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false });

    if (categoryFilter) query = (query as any).eq("category_id", categoryFilter);

    query.then(({ data, error }: any) => {
      if (cancelled) return;
      if (error) {
        setErrorMessage(error.message);
        setItems([]);
      } else {
        setItems((data ?? []) as Item[]);
        setErrorMessage(null);
      }
      setIsLoaded(true);
    });

    return () => { cancelled = true; };
  }, [categoryFilter]);

  // Filter out own items, then apply debounced search
  const visibleItems = useMemo(() => {
    let list = user
      ? items.filter((item) => item.owner_id !== (user as any).id)
      : items;

    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, user, searchText]);

  const showSkeleton = loading || !isLoaded;

  return (
    <div>
      <div className="container top-margin">
        {/* Inline search bar on browse page */}
        <div className="browseSearchRow">
          <input
            className="browseSearchInput"
            type="search"
            placeholder="Search items..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search items"
          />
        </div>

        {searchText && (
          <p className="searchResultLabel">
            Showing results for <strong>&ldquo;{searchText}&rdquo;</strong>{" "}
            &mdash; {visibleItems.length} item{visibleItems.length !== 1 ? "s" : ""} found
          </p>
        )}

        <div className="filterPills">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`pill${categoryFilter === c.id ? " pillActive" : ""}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {showSkeleton ? (
          <SkeletonGrid count={8} />
        ) : errorMessage ? (
          <div className="centerNotice">
            <p className="errorText">{`Failed to load items: ${errorMessage}`}</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="centerNotice">
            {searchText
              ? `No items found for "${searchText}".`
              : user
              ? "No items from other students yet."
              : "No items have been posted yet."}
          </div>
        ) : (
          <div className="cardsGrid">
            {visibleItems.map((item) => (
              <ItemCard key={item.id} item={item} href={`/items/${item.id}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
