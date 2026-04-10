"use client";

import Link from "next/link";
import Image from "next/image";
import { fmtPrice } from "@/lib/utils";

const CONDITION_LABELS = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
};

export default function ItemCard({ item, href, showOwner = true }) {
  const price = fmtPrice(item.daily_rate ?? item.price, true);
  const condLabel = item.condition ? CONDITION_LABELS[item.condition] ?? item.condition.replace("_", " ") : null;

  return (
    <Link href={href} className="itemCardLink">
      <div className="itemCard">
        {item.photo_url ? (
          <div className="itemCardImgWrap">
            <Image
              className="itemCardImg"
              src={item.photo_url}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              style={{ objectFit: "cover" }}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="itemCardImgPlaceholder">No image</div>
        )}
        <div className="itemCardBody">
          {price && (
            <p className="itemCardPrice">
              {price}
              <span className="itemCardPriceUnit">/day</span>
            </p>
          )}
          <p className="itemCardName">{item.name}</p>
          {condLabel && (
            <p className="itemCardMeta itemCardCondition">{condLabel}</p>
          )}
          {showOwner && item.owner_name && (
            <p className="itemCardMeta">{item.owner_name}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
