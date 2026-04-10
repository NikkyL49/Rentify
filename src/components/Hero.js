"use client";

import Link from "next/link";


export default function Hero() {
    

    return(
        <div>
        <section className="hero">
          <p className="heroEyebrow">Student Rental Platform</p>
          <h1 className="heroH1">
            Rent what you need,<br />list what you have.
          </h1>
          <p className="heroSubtitle">
            Textbooks, laptops, calculators and lab equipment — available across all campus locations.
          </p>
          <div className="heroBtns">
            <Link href="/locations" className="btn btnPrimary heroBtnLocations">
              Browse Locations
            </Link>
            <Link href="/items/new" className="btn btnGhost heroBtnList">
              List an Item
            </Link>
          </div>
        </section>
        </div>
    );

}