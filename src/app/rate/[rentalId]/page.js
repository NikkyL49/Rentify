"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

const AUTO_BAN_THRESHOLD = 5;
const ONE_STAR = 1;

const LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
const LABEL_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

async function checkAndAutoban(sellerId) {
  const { data: ratings } = await supabase
    .from("ratings")
    .select("rating")
    .eq("seller_id", sellerId);

  if (!ratings) return false;
  const oneStarCount = ratings.filter((r) => r.rating === ONE_STAR).length;
  if (oneStarCount < AUTO_BAN_THRESHOLD) return false;

  const { error } = await supabase
    .from("profiles")
    .update({
      is_banned: true,
      ban_reason: `Auto-banned: received ${oneStarCount} one-star ratings.`,
    })
    .eq("id", sellerId);

  if (!error) {
    await supabase.from("messages").insert({
      sender_id: sellerId,
      recipient_id: sellerId,
      body: `⚠️ Your account has been automatically suspended after receiving ${oneStarCount} one-star ratings. Please contact an admin to appeal.`,
    });
  }
  return !error;
}

export default function RateSellerPage() {
  const { rentalId } = useParams();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [rental, setRental]               = useState(null);
  const [itemName, setItemName]           = useState("");
  const [alreadyRated, setAlreadyRated]   = useState(false);
  const [existingRating, setExistingRating] = useState(null);
  const [rating, setRating]               = useState(0);
  const [hovered, setHovered]             = useState(0);
  const [review, setReview]               = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [done, setDone]                   = useState(false);
  const [autoBanned, setAutoBanned]       = useState(false);

  useEffect(() => {
    if (!rentalId || !user) return;
    async function load() {
      const [rentalRes, existingRes] = await Promise.all([
        supabase
          .from("rental_transactions")
          .select("id, renter_id, status, item_id, items!inner(name, owner_id)")
          .eq("id", rentalId)
          .single(),
        supabase
          .from("ratings")
          .select("id, rating, review")
          .eq("rental_id", rentalId)
          .maybeSingle(),
      ]);
      if (rentalRes.data) {
        setRental(rentalRes.data);
        setItemName(rentalRes.data.items?.name ?? "");
      }
      if (existingRes.data) {
        setAlreadyRated(true);
        setExistingRating(existingRes.data);
      }
    }
    load();
  }, [rentalId, user]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rental || !user) return;
    if (rental.renter_id !== user.id) { toast("Only the renter can rate this rental.", "error"); return; }
    if (!rating) { toast("Please select a star rating.", "error"); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("ratings").insert([{
        rental_id: rental.id,
        seller_id: rental.items.owner_id,
        buyer_id: user.id,
        rating,
        review,
        created_at: new Date().toISOString(),
      }]);

      if (error) {
        if (error.code === "23505") { toast("You have already rated this rental.", "error"); setAlreadyRated(true); }
        else throw error;
        return;
      }

      if (rating === ONE_STAR) {
        const banned = await checkAndAutoban(rental.items.owner_id);
        if (banned) setAutoBanned(true);
      }

      setDone(true);
      toast("Rating submitted!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to submit rating.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const display = hovered || rating;

  if (loading) return (
    <div><Header /><div className="container"><div className="centerNotice">Loading...</div></div></div>
  );

  return (
    <div>
      <Header />
      <div className="container">
        <div className="rateWrapper">

          {/* ── Done state ── */}
          {done ? (
            <div className="rateSuccess">
              <div className="rateSuccessBigStar">★</div>
              <h1 className="rateH1">Thanks for your rating!</h1>
              <p className="rateSubtitle">
                Your {rating}-star review for <strong>{itemName}</strong> helps other students make better decisions.
              </p>
              {/* Show the submitted stars read-only */}
              <div className="rateStarRowStatic">
                {[1,2,3,4,5].map((n) => (
                  <span key={n} className={`rateStaticStar ${rating >= n ? "rateStaticStarFilled" : "rateStaticStarEmpty"}`}>★</span>
                ))}
              </div>
              {autoBanned && (
                <div className="rateAutoBanNotice">
                  ⚠ This seller has been automatically suspended due to multiple low ratings.
                </div>
              )}
              <div className="rateActions">
                <button className="btn btnPrimary" onClick={() => router.push("/my-rentals")}>Back to My Rentals</button>
                <button className="btn btnGhost"   onClick={() => router.push("/items")}>Browse Items</button>
              </div>
            </div>

          /* ── Already rated state ── */
          ) : alreadyRated ? (
            <div className="rateSuccess">
              <div className="rateSuccessBigStar" style={{ color: "#22c55e" }}>✓</div>
              <h1 className="rateH1">Already Rated</h1>
              <p className="rateSubtitle">
                You gave this rental <strong>{existingRating?.rating} star{existingRating?.rating !== 1 ? "s" : ""}</strong>.
              </p>
              <div className="rateStarRowStatic">
                {[1,2,3,4,5].map((n) => (
                  <span key={n} className={`rateStaticStar ${(existingRating?.rating ?? 0) >= n ? "rateStaticStarFilled" : "rateStaticStarEmpty"}`}>★</span>
                ))}
              </div>
              {existingRating?.review && (
                <blockquote className="rateExistingReview">&ldquo;{existingRating.review}&rdquo;</blockquote>
              )}
              <button className="btn btnGhost" onClick={() => router.push("/my-rentals")}>Back to My Rentals</button>
            </div>

          /* ── Not found / unauthorized ── */
          ) : !rental ? (
            <div className="centerNotice">Rental not found.</div>
          ) : rental.renter_id !== user?.id ? (
            <div className="centerNotice">You can only rate your own rentals.</div>

          /* ── Rating form ── */
          ) : (
            <div className="rateCard">
              <h1 className="rateH1">Rate Your Experience</h1>
              {itemName && (
                <p className="rateSubtitle">How was renting <strong>{itemName}</strong>?</p>
              )}

              <form onSubmit={handleSubmit} className="rateForm">

                {/* ── Star picker ── */}
                <div className="rateStarSection">
                  <div
                    className="rateStarRow"
                    role="group"
                    aria-label="Star rating"
                    onMouseLeave={() => setHovered(0)}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`rateStar ${display >= n ? "rateStarOn" : "rateStarOff"}`}
                        onClick={() => setRating(n)}
                        onMouseEnter={() => setHovered(n)}
                        aria-label={`${n} star${n !== 1 ? "s" : ""}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>

                  {/* Label under stars */}
                  <div className="rateLabelRow">
                    {display > 0 ? (
                      <span
                        className="rateActiveLabel"
                        style={{ color: LABEL_COLORS[display] }}
                      >
                        {LABELS[display]}
                      </span>
                    ) : (
                      <span className="rateActiveLabel" style={{ color: "var(--text-muted)" }}>
                        Tap a star to rate
                      </span>
                    )}
                    {display > 0 && (
                      <span className="rateActiveDots">
                        {[1,2,3,4,5].map((n) => (
                          <span key={n} className={`rateDot ${display >= n ? "rateDotOn" : ""}`} style={display >= n ? { background: LABEL_COLORS[display] } : {}} />
                        ))}
                      </span>
                    )}
                  </div>
                </div>

                {/* Low-rating warning */}
                {rating === 1 && (
                  <div className="rateLowWarning">
                    ⚠ A 1-star rating will be flagged for review. Sellers with {AUTO_BAN_THRESHOLD}+ one-star ratings are automatically suspended.
                  </div>
                )}

                {/* Review textarea */}
                <div className="field rateMt">
                  <label className="label">
                    Review <span className="rateOptional">(optional)</span>
                  </label>
                  <textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    rows={4}
                    placeholder="Describe your experience — was the item as described? Did pickup go smoothly?"
                    maxLength={500}
                  />
                  <p className="rateCharCount">{review.length}/500</p>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !rating}
                  className="btn btnPrimary rateSubmitBtn"
                >
                  {submitting ? "Submitting..." : `Submit ${rating > 0 ? rating + "-Star " : ""}Rating`}
                </button>

              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
